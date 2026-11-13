"""PDF-only resume layout; independent of portfolio markup, images and themes."""
from html import escape
from urllib.parse import urlsplit
from rest_framework.exceptions import ValidationError

TEXT_FIELDS = ('name', 'title', 'bio', 'email', 'phone', 'location')
COLLECTIONS = {
    'links': ('platform', 'url'), 'skills': ('name',),
    'experiences': ('role', 'company', 'startDate', 'endDate', 'description'),
    'education': ('degree', 'institution', 'fieldOfStudy', 'startDate', 'endDate'),
    'projects': ('title', 'description', 'tags', 'demoUrl', 'githubUrl'),
}
TEMPLATE_STYLES = {
    'professional': ('#1e3a8a', '#eff6ff', '#172554', '#bfdbfe', 'Arial,Helvetica,sans-serif'),
    'creative': ('#8646d5', '#f2e7ff', '#3b0764', '#d8b4fe', 'Arial,Helvetica,sans-serif'),
    'minimal': ('#292929', '#ffffff', '#18181b', '#d4d4d8', 'Arial,Helvetica,sans-serif'),
    'modern': ('#23c5ad', '#17313f', '#ffffff', '#2dd4bf', 'Arial,Helvetica,sans-serif'),
    'executive': ('#ca8a04', '#1e293b', '#f8fafc', '#ca8a04', 'Georgia,serif'),
    'developer': ('#238636', '#0d1117', '#c9d1d9', '#238636', "'Courier New',monospace"),
    'elegant': ('#9f1239', '#fff1f2', '#881337', '#fda4af', 'Georgia,serif'),
    'magazine': ('#f43f5e', '#09090b', '#ffffff', '#f43f5e', 'Arial,Helvetica,sans-serif'),
    'bold': ('#ec4899', '#312e81', '#ffffff', '#ec4899', 'Arial,Helvetica,sans-serif'),
    'startup': ('#10b981', '#064e3b', '#ecfdf5', '#10b981', 'Arial,Helvetica,sans-serif'),
}


def resume_source(data):
    if not isinstance(data, dict):
        raise ValidationError('Send a profile object.')
    template_id = data.get('template_id', 'professional')
    if not isinstance(template_id, str) or template_id not in TEMPLATE_STYLES:
        raise ValidationError({'template_id': 'Choose a valid profile template.'})
    accent, header_background, header_color, rule, font = TEMPLATE_STYLES[template_id]
    total = 0
    def text(value):
        nonlocal total
        if value is None:
            return ''
        if not isinstance(value, str):
            raise ValidationError('Resume text fields must be strings.')
        total += len(value)
        if total > 500000:
            raise ValidationError('This resume is too large to export. Please shorten the content.')
        return value
    profile = {key: text(data.get(key, '')) for key in TEXT_FIELDS}
    for key, fields in COLLECTIONS.items():
        rows = data.get(key) or []
        if not isinstance(rows, list) or len(rows) > 500:
            raise ValidationError({key: 'Expected a list of at most 500 entries.'})
        profile[key] = []
        for row in rows:
            if not isinstance(row, dict):
                raise ValidationError({key: 'Each entry must be an object.'})
            clean = {field: text(row.get(field, '')) for field in fields}
            if key == 'experiences':
                if not isinstance(row.get('current', False), bool):
                    raise ValidationError({'current': 'Expected true or false.'})
                clean['current'] = row.get('current', False)
            profile[key].append(clean)

    def paragraph(value, cls=''):
        return f'<p class="{cls}">{escape(value)}</p>' if value.strip() else ''
    def section(title, content):
        return f'<section><h2>{title}</h2>{content}</section>' if content else ''
    def heading(*values):
        value = ' | '.join(value for value in values if value.strip())
        return f'<h3>{escape(value)}</h3>' if value else ''
    def dates(row):
        return ' - '.join(value for value in (row['startDate'], 'Present' if row.get('current') else row['endDate']) if value.strip())
    contact = paragraph(' | '.join(value for value in (profile['email'], profile['phone'], profile['location']) if value.strip()))
    contact += ''.join(paragraph((row['platform'] + ': ' if row['platform'] else '') + row['url']) for row in profile['links'] if row['url'])
    experience = ''.join('<article>' + heading(row['role'], row['company']) + paragraph(dates(row), 'dates') + paragraph(row['description']) + '</article>'
                         for row in profile['experiences'] if any(row[field].strip() for field in COLLECTIONS['experiences']))
    education = ''.join('<article>' + heading(row['degree'], row['institution']) + paragraph(row['fieldOfStudy']) + paragraph(dates(row), 'dates') + '</article>'
                        for row in profile['education'] if any(value.strip() for value in row.values()))
    projects = ''.join('<article>' + heading(row['title']) + paragraph(row['description']) + paragraph(row['tags']) + paragraph(row['demoUrl']) + paragraph(row['githubUrl']) + '</article>'
                       for row in profile['projects'] if any(value.strip() for value in row.values()))
    skills = paragraph(', '.join(row['name'] for row in profile['skills'] if row['name'].strip()))
    links = []
    for value in [row['url'] for row in profile['links']] + [row[key] for row in profile['projects'] for key in ('demoUrl', 'githubUrl')]:
        try:
            parsed = urlsplit(value)
            if len(value) <= 2048 and parsed.scheme in ('http', 'https') and parsed.hostname and not any(ord(char) < 32 for char in value):
                links.append({'text': value, 'url': value})
        except ValueError:
            pass  # Keep malformed URL text visible without making it actionable.
    header = '<header class="resume-header"><h1>' + escape(profile['name']) + '</h1>' + paragraph(profile['title'], 'role')
    header += section('Contact Information', contact) + '</header>'
    content = section('Professional Summary', paragraph(profile['bio']))
    content += section('Work Experience', experience) + section('Education', education)
    content += section('Technical Skills', skills) + section('Projects', projects)
    return {'title': (profile['name'] or 'Professional') + ' - Resume', 'links': links,
            'html': f'<!doctype html><html lang="en"><head><title>Professional Resume</title></head><body class="resume-template-{template_id}">'
                    + header + '<main>' + content + '</main></body></html>',
            'css': f'''@page {{ size:A4; margin:17mm 18mm; }}
 :root {{ --resume-accent:{accent}; --resume-header-background:{header_background}; --resume-header-color:{header_color}; --resume-rule:{rule}; --resume-font:{font}; }}
html,body {{ background:#fff; color:#000; }}
body {{ width:auto; min-height:0; margin:0; padding:0; color:#172033; font:10.5pt/1.45 var(--resume-font); overflow-wrap:anywhere; }}
.resume-header {{ background:var(--resume-header-background); color:var(--resume-header-color); border-bottom:2pt solid var(--resume-rule); padding:6mm 7mm; margin-bottom:5mm; }}
h1 {{ font-size:24pt; font-weight:700; line-height:1.15; margin:0 0 2mm; color:var(--resume-header-color); }}
.role {{ font-size:12pt; margin-bottom:4mm; }}
h2 {{ font-size:10.5pt; font-weight:700; letter-spacing:.5pt; text-transform:uppercase; color:var(--resume-accent); border-bottom:.6pt solid var(--resume-rule); padding-bottom:1.3mm; margin:5mm 0 2.5mm; break-after:avoid; }}
.resume-header h2 {{ color:inherit; border-color:var(--resume-rule); }}
h3 {{ font-size:10.5pt; font-weight:700; margin:3mm 0 1mm; break-after:avoid; }}
p {{ margin:0 0 2mm; white-space:pre-wrap; orphans:3; widows:3; }}
.dates {{ font-size:9.5pt; margin-bottom:2mm; break-after:avoid; }}
article {{ margin:0 0 3mm; break-inside:avoid; }} section {{ break-inside:auto; }}
main {{ margin:0; padding:0; }}'''}
