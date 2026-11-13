"""Run with: python -m cvbuilder.benchmark (from backend). No real CV data used."""
import json
import os
from pathlib import Path
from time import perf_counter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.test_settings')
import django
django.setup()
from .rendering import clear_pdf_cache, render_pdf, render_pdf_uncached
from .analysis import analyze


def measure(fn):
    started = perf_counter()
    value = fn()
    return round((perf_counter() - started) * 1000, 2), value


def main():
    source = {'title': 'Benchmark CV', 'html': '<h1>Benchmark Engineer</h1><p>engineer@example.com</p><h2>Work Experience</h2>' + '<h3>Engineer</h3><p>Built Python APIs and tested SQL queries.</p>' * 25, 'css': ''}
    uncached, pdf = measure(lambda: render_pdf_uncached(source))
    clear_pdf_cache()
    cold, _ = measure(lambda: render_pdf(source))
    warm, _ = measure(lambda: render_pdf(source))
    analysis, _ = measure(lambda: analyze(source, 'Required: Python and SQL. Preferred: Docker.'))
    result = {'uncachedPdfMs': uncached, 'cacheColdPdfMs': cold, 'cacheWarmPdfMs': warm,
              'analysisMs': analysis, 'pdfBytes': len(pdf), 'sourceChars': len(source['html']),
              'notes': 'Local synthetic document. Drive/network authorization is still performed before cache access; these timings exclude cloud calls. Cache expires after 120 seconds and changes invalidate by source hash.'}
    target = Path(__file__).resolve().parents[2] / 'artifacts' / 'cv-performance.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
