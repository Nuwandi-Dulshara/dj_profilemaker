"""Generate a repeatable multi-page fixture and rendered pages for visual QA.

Run from backend: python -m profiles.check_resume_sample
"""
import os
from pathlib import Path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.test_settings')
import django
django.setup()

from cvbuilder.rendering import render_pdf
from profiles.resume_pdf import resume_source
from profiles.test_resume_pdf import sample_profile
import pypdfium2 as pdfium


def main():
    profile = sample_profile()
    profile['experiences'] = [dict(profile['experiences'][0], role=f'Engineer role {i}',
        description=('Maintained reliable applications with automated testing and accessible interfaces. ' * 12) + f' END-ENTRY-{i}') for i in range(9)]
    folder = Path(__file__).resolve().parents[2] / 'artifacts' / 'cv-task-verification'
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / 'multipage-resume.pdf'
    target.write_bytes(render_pdf(resume_source(profile)))
    pdf = pdfium.PdfDocument(str(target))
    for i, page in enumerate(pdf):
        page.render(scale=1.25).to_pil().save(folder / f'page-{i+1}.png')
    print(f'Generated {len(pdf)} A4 pages: {target}')


if __name__ == '__main__':
    main()
