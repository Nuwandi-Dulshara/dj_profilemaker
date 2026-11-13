"""Bounded document extraction. Originals are never rewritten by this module."""
import csv
import io
import re
import subprocess
import zipfile
from html import escape
from pathlib import Path
from xml.etree import ElementTree as ET

import html5lib
from django.conf import settings
from PIL import Image, UnidentifiedImageError
from pypdf.errors import PyPdfError
from .errors import CvError

HEADINGS = {'summary', 'professional summary', 'experience', 'work experience', 'education',
            'skills', 'technical skills', 'projects', 'certifications', 'achievements', 'languages'}
DOCUMENT_CSS = '''@page {size:A4; margin:16mm} body {width:210mm; padding:16mm; font:11pt/1.5 Arial,sans-serif}
h1 {font-size:24pt} h2 {font-size:13pt; border-bottom:1px solid #cbd5e1; margin-top:6mm}
p {white-space:pre-wrap} h1,h2,h3 {break-after:avoid} li {break-inside:avoid}
@media print {body {width:auto; min-height:0; padding:0; margin:0}}'''


def text_source(text, title):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    elements = []
    for index, line in enumerate(lines):
        tag = 'h2' if line.lower().rstrip(':') in HEADINGS else 'h1' if index == 0 else 'p'
        elements.append(f'<{tag}>{escape(line)}</{tag}>')
    return {'title': title, 'html': '<main class="cv-document">\n' + '\n'.join(elements) + '\n</main>', 'css': DOCUMENT_CSS}


def html_text(source):
    root = html5lib.parse(source, namespaceHTMLElements=False)
    for parent in root.iter():
        for child in list(parent):
            if child.tag in ('script', 'style', 'head', 'template', 'noscript'):
                parent.remove(child)
    return '\n'.join(part.strip() for part in root.itertext() if part.strip())


def risk(ident, message, recommendation, section='Document', kind='risk'):
    return {'id': ident, 'severity': 'warning', 'kind': kind, 'section': section,
            'message': message, 'recommendation': recommendation, 'priority': 2}


def ocr_image(data):
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ('PNG', 'JPEG', 'WEBP') or image.width * image.height > 25_000_000:
                raise CvError('Use a PNG, JPEG or WebP image with at most 25 million pixels.')
            image.load()
            output = io.BytesIO()
            image.convert('RGB').save(output, format='PNG')
            mime = Image.MIME[image.format]
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise CvError('The image is corrupt or unsupported.') from None
    try:
        process = subprocess.run([settings.CV_TESSERACT_COMMAND, 'stdin', 'stdout', '-l', settings.CV_OCR_LANGUAGE, 'tsv'],
                                 input=output.getvalue(), capture_output=True, timeout=45, check=False)
    except (FileNotFoundError, PermissionError):
        raise CvError('OCR is unavailable. Install Tesseract and configure CV_TESSERACT_COMMAND.', 503) from None
    except subprocess.TimeoutExpired:
        raise CvError('OCR timed out. Try a smaller, clearer image.', 422) from None
    if process.returncode:
        raise CvError('OCR could not read this image. Check the configured OCR language and image quality.', 422)
    lines, uncertain, boxes = {}, [], []
    try:
        for row in csv.DictReader(io.StringIO(process.stdout.decode('utf-8')), delimiter='\t'):
            word = row.get('text', '').strip()
            if not word:
                continue
            confidence = float(row['conf'])
            key = tuple(row[k] for k in ('page_num', 'block_num', 'par_num', 'line_num'))
            lines.setdefault(key, []).append(word)
            if confidence < 70:
                uncertain.append({'text': word, 'confidence': confidence})
            boxes.append({'text': word, 'confidence': confidence, **{k: int(row[k]) for k in ('left', 'top', 'width', 'height')}})
    except (ValueError, KeyError, UnicodeError):
        raise CvError('OCR returned unreadable output.', 502) from None
    return '\n'.join(' '.join(words) for words in lines.values()), mime, uncertain, boxes


def extract_document(data, filename):
    if not data or len(data) > settings.CV_UPLOAD_MAX_BYTES:
        raise CvError(f'Upload a nonempty file smaller than {settings.CV_UPLOAD_MAX_BYTES // (1024 * 1024)} MB.')
    suffix = Path(filename).suffix.lower()
    title = Path(filename).stem[:255] or 'Imported CV'
    issues, limitations, uncertain, boxes = [], [], [], []
    conversion = 'reconstructed'
    source = None
    layout_source = None
    try:
        if suffix in ('.html', '.htm', '.txt'):
            raw = data.decode('utf-8-sig')
            mime = 'text/html' if suffix != '.txt' else 'text/plain'
            text = html_text(raw) if mime == 'text/html' else raw
            if mime == 'text/html':
                source = {'title': title, 'html': raw, 'css': ''}
                conversion = 'original-html'
                limitations.append('Original HTML is preserved. Scripts and external resources are disabled in previews.')
        elif suffix == '.docx':
            mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if sum(item.file_size for item in archive.infolist()) > 30 * 1024 * 1024 or len(archive.infolist()) > 2000:
                    raise CvError('The expanded DOCX is too large.')
                ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                def read_xml(name):
                    raw = archive.read(name)
                    if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:
                        raise CvError('DOCX XML entities are unsupported.')
                    return ET.fromstring(raw)
                root = read_xml('word/document.xml')
                text = '\n'.join(''.join(p.itertext()) for p in root.findall('.//w:p', ns))
                tables = root.findall('.//w:tbl', ns)
                if tables:
                    issues.append(risk('docx-tables', f'{len(tables)} table(s) found in the original DOCX.', 'Use normal paragraphs for CV sections.'))
                if any(table.findall('.//w:tbl', ns) for table in tables):
                    issues.append(risk('docx-nested-tables', 'Nested tables can disturb reading order.', 'Flatten nested tables.'))
                if root.findall('.//w:txbxContent', ns):
                    issues.append(risk('docx-textboxes', 'Text boxes detected.', 'Move text into the main body.'))
                if root.findall('.//w:drawing', ns):
                    issues.append(risk('docx-graphics', 'Graphics detected; embedded image text has not been OCR checked.', 'Ensure important details also appear as body text.'))
                for columns in root.findall('.//w:cols', ns):
                    if int(columns.get('{'+ns['w']+'}num', '1')) > 1:
                        issues.append(risk('docx-columns', 'Multiple document columns detected.', 'Use a single column.'))
                for name in archive.namelist():
                    if re.fullmatch(r'word/(header|footer)\d+\.xml', name):
                        content = ' '.join(read_xml(name).itertext()).strip()
                        if content:
                            text += '\n' + content
                            issues.append(risk('docx-header-footer', 'Original header/footer contains text: ' + content[:200], 'Move essential contact details into the document body.', 'Contact'))
            limitations.append('DOCX text is reconstructed; original typography, drawings and reading order may differ.')
        elif suffix == '.pdf':
            from pypdf import PdfReader
            if not data.startswith(b'%PDF-'):
                raise CvError('This file is not a valid PDF.')
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise CvError('Remove the PDF password before uploading.')
            if len(reader.pages) > 30:
                raise CvError('Upload a document with at most 30 pages.')
            texts = []
            for number, page in enumerate(reader.pages):
                positions = []
                def visitor(value, cm, tm, font, size):
                    if value.strip():
                        positions.append({'text': value.strip(), 'x': tm[4], 'y': tm[5], 'page': number + 1})
                texts.append(page.extract_text(visitor_text=visitor) or '')
                boxes.extend(positions)
                height = float(page.mediabox.height)
                edge_text = ' '.join(p['text'] for p in positions if p['y'] < 45 or p['y'] > height - 45)
                if '@' in edge_text or re.search(r'\+?\d[\d ()-]{7,}', edge_text):
                    issues.append(risk('pdf-header-footer', 'Contact-like text appears near a page edge.', 'Verify contact details appear in the main reading flow.', 'Contact'))
                resources = page.get('/Resources', {})
                if resources and resources.get('/XObject'):
                    issues.append(risk('pdf-graphics', 'PDF graphic objects detected; they may include image text.', 'Check the extracted text against the original.'))
            text, mime = '\n\n'.join(texts), 'application/pdf'
            from .pdf_layout import inspect_pdf
            layout_issues, layout_source = inspect_pdf(data, title)
            issues.extend(layout_issues)
            limitations.append('PDF is reconstructed from its text layer, not recovered HTML. Ruled-table and column checks are heuristic. Optional detected layout approximates text placement with substitute fonts; graphics are not reproduced. Image-only PDF pages need OCR outside this text extractor.')
        elif suffix in ('.png', '.jpg', '.jpeg', '.webp'):
            text, mime, uncertain, boxes = ocr_image(data)
            limitations.append('OCR may misread text and order. Review the original image and correct the extracted text before generating a CV.')
            issues.append(risk('image-ocr', 'The original CV is an image; OCR generated editable text.', 'Verify every contact detail, date and qualification against the original.'))
        else:
            raise CvError('Supported files: PDF, DOCX, HTML, TXT, PNG, JPEG and WebP.')
    except CvError:
        raise
    except (ValueError, UnicodeError, KeyError, OSError, zipfile.BadZipFile, ET.ParseError, TypeError, PyPdfError):
        raise CvError('The document is corrupt or uses an unsupported encoding. Use a valid UTF-8 HTML/TXT, PDF or DOCX file.') from None
    if not text.strip():
        issues.append(risk('missing-text', 'No readable text could be extracted.', 'Use OCR on a clear image or enter the text manually.', kind='confirmed'))
    return {'text': text, 'source': source or text_source(text, title), 'mime': mime,
            'conversion': conversion, 'issues': issues, 'limitations': limitations,
            'uncertain': uncertain, 'boxes': boxes, 'layoutSource': layout_source}
