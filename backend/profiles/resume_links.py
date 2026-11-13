"""Clickable URL annotations over real PDF text, including wrapped URLs."""
import io
import re
from collections import defaultdict
import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link


def add_resume_links(pdf, links):
    if not links:
        return pdf
    writer = PdfWriter()
    writer.clone_document_from_reader(PdfReader(io.BytesIO(pdf)))
    with pdfplumber.open(io.BytesIO(pdf)) as document:
        for index, page in enumerate(document.pages):
            for value, url in dict((item['text'], item['url']) for item in links).items():
                # PDF text extraction can insert spaces/newlines at visual wraps.
                pattern = r'\s*'.join(re.escape(char) for char in value if not char.isspace())
                for match in page.search(pattern) or []:
                    lines = defaultdict(list)
                    for char in match['chars']:
                        lines[round(char['top'], 1)].append(char)
                    for chars in lines.values():
                        rect = (min(c['x0'] for c in chars), page.height-max(c['bottom'] for c in chars),
                                max(c['x1'] for c in chars), page.height-min(c['top'] for c in chars))
                        writer.add_annotation(index, Link(rect=rect, url=url))
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()
