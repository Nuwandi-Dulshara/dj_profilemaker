"""Spatial PDF checks and an optional editable approximation of text placement."""
import io
from collections import defaultdict
from html import escape
import pdfplumber


def inspect_pdf(data, title):
    from .extraction import risk
    issues, pages = [], []
    with pdfplumber.open(io.BytesIO(data)) as document:
        for number, page in enumerate(document.pages, 1):
            if len(page.chars) > 100000:
                from .errors import CvError
                raise CvError('PDF page text is too complex. Simplify the document before uploading.')
            tables = page.find_tables()
            if tables:
                issues.append(risk('pdf-tables', f'Page {number}: {len(tables)} ruled table(s) detected.', 'Use paragraphs rather than tables for essential CV information.'))
            words = page.extract_words(extra_attrs=['fontname', 'size'])
            rows = defaultdict(list)
            for word in words:
                rows[round(word['top']/4)].append(word)
            gaps = 0
            for row in rows.values():
                row.sort(key=lambda word: word['x0'])
                if any(right['x0'] - left['x1'] > 90 for left, right in zip(row, row[1:])):
                    gaps += 1
            if gaps >= 3:
                issues.append(risk('pdf-columns', f'Page {number}: repeated wide horizontal gaps suggest columns or aligned table cells.', 'Compare extracted reading order with the original; use a single-column alternative.'))
            fontnames = sorted({str(char.get('fontname','')) for char in page.chars})
            unusual = [font for font in fontnames if any(term in font.lower() for term in ('symbol','wingding','dingbat','icon'))]
            if unusual:
                issues.append(risk('pdf-symbol-font', 'Symbol/icon fonts detected: '+', '.join(unusual), 'Use ordinary text labels for contact details and section headings.'))
            if any(float(char.get('size',11)) < 7 for char in page.chars):
                issues.append(risk('pdf-small-font', f'Page {number} contains text smaller than 7 points.', 'Increase small text size and verify extracted characters.'))
            spans=[]
            scale=min(595.28/float(page.width), 841.89/float(page.height))
            for word in words:
                bold='bold' in word['fontname'].lower()
                spans.append(f'<span style="position:absolute;left:{word["x0"]*scale:.2f}pt;top:{word["top"]*scale:.2f}pt;font-size:{word["size"]*scale:.2f}pt;font-weight:{700 if bold else 400}">{escape(word["text"])}</span>')
            pages.append('<section class="pdf-page">'+''.join(spans)+'</section>')
    layout = {'title': title, 'html': '<main>'+''.join(pages)+'</main>', 'css':
              '@page {size:A4; margin:0} body {width:210mm; padding:0!important; margin:0; font-family:Arial,sans-serif} .pdf-page {position:relative; width:210mm; height:297mm; break-after:page} .pdf-page:last-child {break-after:auto} .pdf-page span {white-space:pre}'}
    return issues, layout
