"""Inert HTML shared by saved preview and a network-isolated Chromium worker."""
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
import time
import hashlib
import json
from collections import OrderedDict
from xml.etree import ElementTree as ET

import html5lib
from django.conf import settings

from .errors import CvError


ASSETS = Path(__file__).parent / "static" / "cvbuilder"
TAGS = set("html head body title style a abbr address article aside b blockquote br caption code col colgroup dd div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img li main ol p pre s section small span strong sub sup table tbody td th thead time tr u ul".split())
ATTRS = {"class", "id", "style", "title", "lang", "dir", "alt", "width", "height", "colspan", "rowspan"}
POLICY = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
SLOTS = threading.BoundedSemaphore(max(1, settings.CV_PDF_CONCURRENCY))


def build_preview(source):
    doc = html5lib.parse(source["html"], namespaceHTMLElements=False)
    for parent in list(doc.iter()):
        for node in list(parent):
            if node.tag not in TAGS:
                parent.remove(node)
        for attr in list(parent.attrib):
            value = parent.attrib[attr]
            image = parent.tag == "img" and attr == "src" and re.fullmatch(r"data:image/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+", value, flags=re.I)
            media = parent.tag == "style" and attr == "media"
            if attr not in ATTRS and not image and not media:
                del parent.attrib[attr]
    doc.set("lang", doc.get("lang", "en"))
    if not re.search(r"<!doctype\s+html\b|<(?:html|head|body)(?:\s|>)", source["html"], flags=re.I):
        doc.find("body").set("data-cv-fragment", "true")
    head = doc.find("head")
    additions = [ET.Element("meta", {"http-equiv": "Content-Security-Policy", "content": POLICY}),
                 ET.Element("meta", {"charset": "utf-8"}),
                 ET.Element("meta", {"name": "viewport", "content": "width=device-width, initial-scale=1"})]
    for name in ("bootstrap.min.css", "page.css"):
        style = ET.Element("style")
        style.text = (ASSETS / name).read_text(encoding="utf-8").replace("<", "\\3c ")
        additions.append(style)
    for index, element in enumerate(additions):
        head.insert(index, element)
    legacy = ET.SubElement(head, "style")
    legacy.text = source.get("css", "").replace("<", "\\3c ")
    # A4 is the export contract, even if authored CSS requests another paper size.
    paper = ET.SubElement(doc.find("body"), "style")
    paper.text = "@page { size: A4 !important; }"
    return "<!doctype html>" + html5lib.serialize(doc, tree="etree", omit_optional_tags=False, quote_attr_values="always")


PDF_CACHE = OrderedDict()
PDF_CACHE_LOCK = threading.Lock()


def clear_pdf_cache():
    with PDF_CACHE_LOCK:
        PDF_CACHE.clear()


def render_pdf(source):
    # Callers still verify cloud ownership and current saved revision before this.
    key = hashlib.sha256(json.dumps(source, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    now = time.monotonic()
    with PDF_CACHE_LOCK:
        for old in list(PDF_CACHE):
            if PDF_CACHE[old][0] <= now:
                del PDF_CACHE[old]
        if key in PDF_CACHE:
            PDF_CACHE.move_to_end(key)
            return PDF_CACHE[key][1]
    result = render_pdf_uncached(source)
    if len(result) <= 5 * 1024 * 1024:
        with PDF_CACHE_LOCK:
            PDF_CACHE[key] = (time.monotonic() + 120, result)
            while len(PDF_CACHE) > 8:
                PDF_CACHE.popitem(last=False)
    return result


def render_pdf_uncached(source):
    if not SLOTS.acquire(blocking=False):
        raise CvError("The PDF renderer is busy. Please retry shortly.", 429)
    process = None
    try:
        html = build_preview(source).encode("utf-8")
        process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("pdf_worker.py"))],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   start_new_session=os.name != "nt")
        try:
            pdf, _ = process.communicate(html, timeout=settings.CV_PDF_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.kill()
            process.communicate()
            raise CvError("PDF rendering timed out. Simplify unusually complex layout or retry.", 503) from None
        if process.returncode != 0 or not pdf.startswith(b"%PDF-"):
            raise CvError("PDF rendering failed. Verify the server Chromium installation and retry.", 503)
        return pdf
    finally:
        SLOTS.release()
