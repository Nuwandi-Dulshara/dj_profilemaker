"""Shared structured-document services (Advanced CV now; reused by templates and letters)."""
import io
import json
import re
import zipfile
from collections import Counter
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, NotFound, ValidationError
from .models import Activity, CareerProfile, Document, DocumentVersion, Project
from .services import create_project

MAX_PART_BYTES = 512 * 1024
PAGE_SIZES = {'A4', 'Letter'}
FONTS = {'Georgia', 'Arial', 'Calibri', 'Times New Roman', 'Verdana', 'Trebuchet MS'}
SECTION_KEYS = {'summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'achievements', 'publications', 'languages', 'volunteering', 'references', 'custom'}
STOPWORDS = {
    'about', 'above', 'after', 'again', 'against', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be',
    'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
    'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her',
    'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just',
    'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
    'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the',
    'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
    'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
    'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'role', 'work', 'team', 'using',
    'experience', 'looking', 'candidate', 'strong', 'ability', 'including', 'within', 'across', 'must', 'plus', 'years',
}
WEAK_VERBS = {'helped', 'worked', 'assisted', 'responsible', 'handled', 'participated', 'supported', 'duties'}
STRONG_VERBS = {'built', 'designed', 'led', 'delivered', 'launched', 'improved', 'reduced', 'automated', 'architected', 'implemented', 'optimized', 'created'}


class RevisionConflict(APIException):
    status_code = 409
    default_detail = 'This document was changed elsewhere. Reload the latest version before saving.'
    default_code = 'revision_conflict'


def validate_payload(content, design):
    if not isinstance(content, dict):
        raise ValidationError({'content': 'Content must be an object.'})
    if not isinstance(design, dict):
        raise ValidationError({'design': 'Design must be an object.'})
    for label, part in (('content', content), ('design', design)):
        if len(json.dumps(part)) > MAX_PART_BYTES:
            raise ValidationError({label: 'Document data is too large.'})
    if not isinstance(design.get('pageSize', 'A4'), str) or design.get('pageSize', 'A4') not in PAGE_SIZES:
        raise ValidationError({'design': 'Page size must be A4 or Letter.'})
    if not isinstance(design.get('fontFamily', 'Georgia'), str) or design.get('fontFamily', 'Georgia') not in FONTS:
        raise ValidationError({'design': 'Choose a supported font.'})
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', str(design.get('accent', '#0B1F3A'))):
        raise ValidationError({'design': 'Accent colour must be a hex value such as #0B1F3A.'})
    for key, low, high in (('fontSize', 8, 16), ('margin', 5, 40), ('lineHeight', 1, 2), ('sectionSpacing', 0.3, 3)):
        value = design.get(key, low)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not low <= value <= high:
            raise ValidationError({'design': f'{key} must be between {low} and {high}.'})
    for key in ('order', 'hidden', 'pageBreaks'):
        value = design.get(key, [])
        if not isinstance(value, list) or any(not isinstance(item, str) or item not in SECTION_KEYS for item in value):
            raise ValidationError({'design': f'{key} must list known sections.'})


    for key, choices, default in [('layout', {'single', 'two-column', 'sidebar'}, 'single'), ('headingStyle', {'line', 'plain', 'band'}, 'line'), ('headerStyle', {'left', 'center', 'banner'}, 'left')]:
        if not isinstance(design.get(key, default), str) or design.get(key, default) not in choices:
            raise ValidationError({'design': f'Unsupported {key}.'})
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', str(design.get('textColor', '#111827'))):
        raise ValidationError({'design': 'Text colour must be a six-digit hex colour.'})
    headings = design.get('headings', {})
    if not isinstance(headings, dict) or any(key not in SECTION_KEYS or not isinstance(value, str) or len(value) > 80 for key, value in headings.items()):
        raise ValidationError({'design': 'Headings must map known sections to text of at most 80 characters.'})
    if 'templateId' in design and (not isinstance(design['templateId'], str) or len(design['templateId']) > 100):
        raise ValidationError({'design': 'Template identifier must be a short string.'})


def _project(user, pk):
    return get_object_or_404(Project, pk=pk, owner=user, deleted_at__isnull=True)


def document_payload(project, document):
    return {'project': {'id': str(project.id), 'title': project.title, 'kind': project.kind}, 'content': document.content, 'design': document.design, 'revision': document.revision, 'schema_version': document.schema_version}


def _locked(user, pk):
    document = Document.objects.select_for_update(of=('self',)).select_related('project').filter(project_id=pk, project__owner=user, project__deleted_at__isnull=True).first()
    if document is None:
        project = _project(user, pk)
        document = Document.objects.create(project=project)
    return document


def load_document(user, pk):
    project = _project(user, pk)
    document, _ = Document.objects.get_or_create(project=project)
    return document_payload(project, document)


@transaction.atomic
def save_document(user, pk, data):
    content, design, revision = data.get('content'), data.get('design'), data.get('revision')
    if isinstance(revision, bool) or not isinstance(revision, int):
        raise ValidationError({'revision': 'Send the revision you are editing.'})
    validate_payload(content, design)
    document = _locked(user, pk)
    if revision != document.revision:
        raise RevisionConflict()
    document.content, document.design = content, design
    document.revision += 1
    document.save(update_fields=['content', 'design', 'revision'])
    document.project.save(update_fields=['updated_at'])
    return document_payload(document.project, document)


def version_payload(version):
    return {'id': version.id, 'name': version.name, 'revision': version.revision, 'created_at': version.created_at}


@transaction.atomic
def create_version(user, pk, name):
    name = str(name or '').strip()[:120] or 'Saved version'
    document = _locked(user, pk)
    return version_payload(DocumentVersion.objects.create(document=document, name=name, content=document.content, design=document.design, revision=document.revision))


def list_versions(user, pk):
    project = _project(user, pk)
    document = Document.objects.filter(project=project).first()
    versions = DocumentVersion.objects.filter(document=document)[:50] if document else []
    return [version_payload(v) for v in versions]


@transaction.atomic
def restore_version(user, pk, version_id):
    document = _locked(user, pk)
    version = DocumentVersion.objects.filter(document=document, pk=version_id).first()
    if version is None:
        raise NotFound('Version not found.')
    DocumentVersion.objects.create(document=document, name=f'Before restoring “{version.name}”', content=document.content, design=document.design, revision=document.revision)
    document.content, document.design = version.content, version.design
    document.revision += 1
    document.save(update_fields=['content', 'design', 'revision'])
    document.project.save(update_fields=['updated_at'])
    return document_payload(document.project, document)


def _extract_cv_text(content):
    parts = []
    personal = content.get('personal') if isinstance(content.get('personal'), dict) else {}
    parts.extend(str(v) for v in personal.values() if v)
    if isinstance(content.get('summary'), str):
        parts.append(content['summary'])
    for key in SECTION_KEYS - {'summary'}:
        items = content.get(key)
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    parts.extend(str(v) for k, v in item.items() if k != 'id' and v)
    return ' '.join(parts)


def analyze_ats(user, pk):
    payload = load_document(user, pk)
    content = payload['content'] if isinstance(payload['content'], dict) else {}
    design = payload['design'] if isinstance(payload['design'], dict) else {}
    personal = content.get('personal') if isinstance(content.get('personal'), dict) else {}
    checks = []

    has_contact = bool(str(personal.get('name', '')).strip() and str(personal.get('email', '')).strip() and str(personal.get('phone', '')).strip())
    checks.append({
        'category': 'Contact information',
        'status': 'pass' if has_contact else 'warning',
        'message': 'Name, email, and phone number are present.' if has_contact else 'Include your full name, email address, and phone number so ATS parsers can identify your profile.',
    })

    font = design.get('fontFamily', 'Georgia')
    font_size = design.get('fontSize', 11)
    good_font = font in FONTS and 9.5 <= float(font_size) <= 13.5
    checks.append({
        'category': 'Fonts and symbols',
        'status': 'pass' if good_font else 'warning',
        'message': f'Using standard ATS-safe font ({font}, {font_size}pt).' if good_font else 'Use a standard font between 10pt and 13pt for reliable text extraction.',
    })

    checks.append({
        'category': 'Layout, columns, tables, and reading order',
        'status': 'pass' if design.get('layout', 'single') == 'single' else 'warning',
        'message': 'Single-column semantic HTML/React structure without nested layout tables or floating graphics ensures linear top-to-bottom reading order and selectable PDF text extraction.' if design.get('layout', 'single') == 'single' else 'Multiple columns can affect ATS text extraction and reading order. Review exported text before submitting.',
    })

    hidden = set(design.get('hidden') if isinstance(design.get('hidden'), list) else [])
    core_sections = [('summary', 'Professional Summary'), ('experience', 'Work Experience'), ('education', 'Education'), ('skills', 'Skills')]
    missing = []
    for key, label in core_sections:
        if key in hidden:
            missing.append(f'{label} (hidden)')
        elif key == 'summary':
            if not str(content.get('summary', '')).strip():
                missing.append(label)
        else:
            items = content.get(key)
            if not isinstance(items, list) or len(items) == 0:
                missing.append(label)
    checks.append({
        'category': 'Section headings and completeness',
        'status': 'pass' if not missing else 'warning',
        'message': 'All core CV sections (Summary, Experience, Education, Skills) are populated and visible.' if not missing else f'Missing or empty core sections: {", ".join(missing)}.',
    })

    skills = [str(i.get('name', '')).strip() for i in (content.get('skills') or []) if isinstance(i, dict) and str(i.get('name', '')).strip()]
    checks.append({
        'category': 'Keywords',
        'status': 'pass' if len(skills) >= 5 else 'warning',
        'message': f'{len(skills)} explicit skills listed for keyword indexing.' if len(skills) >= 5 else 'Add at least 5 relevant technical or domain skills to improve keyword coverage.',
    })

    passed = sum(1 for c in checks if c['status'] == 'pass')
    score = round(passed / len(checks) * 100)
    return {
        'score': score,
        'checks': checks,
        'disclaimer': 'ATS checks evaluate structural readability and completeness; they do not guarantee automated screening acceptance.',
    }


def analyze_content(user, pk):
    payload = load_document(user, pk)
    content = payload['content'] if isinstance(payload['content'], dict) else {}
    findings = []
    suggestions = []

    summary = str(content.get('summary', '')).strip()
    summary_words = re.findall(r'\b[a-zA-Z]{2,}\b', summary)
    if not summary:
        findings.append({'category': 'Summary quality', 'severity': 'warning', 'message': 'Your professional summary is empty.'})
        suggestions.append({
            'id': 'summary-template',
            'label': 'Add a structured summary starter',
            'section': 'summary',
            'preview': 'Results-driven professional with experience designing, building, and delivering reliable solutions across cross-functional teams.',
        })
    elif len(summary_words) < 15:
        findings.append({'category': 'Summary quality', 'severity': 'warning', 'message': f'Summary is brief ({len(summary_words)} words). Aim for 25–60 words highlighting scope and impact.'})
    else:
        findings.append({'category': 'Summary quality', 'severity': 'good', 'message': f'Summary length ({len(summary_words)} words) is clear and concise.'})

    experiences = content.get('experience') if isinstance(content.get('experience'), list) else []
    weak_found = set()
    measurable_count = 0
    for idx, exp in enumerate(experiences):
        if not isinstance(exp, dict):
            continue
        desc = str(exp.get('description', '')).strip()
        words = [w.lower() for w in re.findall(r'\b[a-zA-Z]+\b', desc)]
        weak_found.update(w for w in words if w in WEAK_VERBS)
        if re.search(r'(\d+%|\$\d+|\d+\+|\b\d+\s+(?:users|clients|projects|teams|ms|seconds|hours|days|months|years)\b)', desc, re.I):
            measurable_count += 1
        if desc and not any(w in STRONG_VERBS for w in words[:4]):
            role_label = exp.get('role') or f'Role {idx + 1}'
            suggestions.append({
                'id': f'exp-verb-{idx}',
                'label': f'Strengthen opening action verb in {role_label}',
                'section': 'experience',
                'index': idx,
                'preview': f'Delivered {desc[0].lower() + desc[1:] if len(desc) > 1 else desc}',
            })

    if weak_found:
        findings.append({'category': 'Action verbs', 'severity': 'warning', 'message': f'Found passive or weak verbs ({", ".join(sorted(weak_found))}). Replace with direct action verbs like Delivered, Built, or Led.'})
    else:
        findings.append({'category': 'Action verbs', 'severity': 'good', 'message': 'No weak phrasing detected in work experience.'})

    if experiences and measurable_count == 0:
        findings.append({'category': 'Measurable achievements', 'severity': 'warning', 'message': 'No quantified outcomes (%, $, counts, or timeframes) detected in experience descriptions.'})
    elif experiences:
        findings.append({'category': 'Measurable achievements', 'severity': 'good', 'message': f'{measurable_count} of {len(experiences)} experience entries include measurable metrics.'})

    all_words = [w.lower() for w in re.findall(r'\b[a-zA-Z]{4,}\b', _extract_cv_text(content)) if w.lower() not in STOPWORDS]
    repeated = [word for word, count in Counter(all_words).most_common(5) if count >= 4]
    if repeated:
        findings.append({'category': 'Repeated words', 'severity': 'info', 'message': f'Frequently repeated terms: {", ".join(repeated)}. Consider varying your vocabulary.'})
    else:
        findings.append({'category': 'Repeated words', 'severity': 'good', 'message': 'Vocabulary is varied without excessive repetition.'})

    return {'findings': findings, 'suggestions': suggestions}


def _extract_jd_keywords(job_description):
    tokens = re.findall(r'\b[A-Za-z][A-Za-z0-9+#.-]{2,}\b', job_description)
    counts = Counter()
    canonical = {}
    for token in tokens:
        clean = token.strip('.-')
        low = clean.lower()
        if len(low) < 3 or low in STOPWORDS:
            continue
        counts[low] += 1
        canonical.setdefault(low, clean)
    ranked = [canonical[k] for k, _ in counts.most_common(20)]
    return ranked


def match_job_description(user, pk, job_description):
    jd_text = str(job_description or '').strip()
    if len(jd_text) < 20:
        raise ValidationError({'job_description': 'Paste a job description of at least 20 characters.'})
    payload = load_document(user, pk)
    cv_text = _extract_cv_text(payload['content']).lower()
    keywords = _extract_jd_keywords(jd_text)
    matched = [kw for kw in keywords if re.search(r'\b' + re.escape(kw.lower()) + r'\b', cv_text)]
    missing = [kw for kw in keywords if kw not in matched]
    score = round(len(matched) / len(keywords) * 100) if keywords else 100
    recommendations = []
    if missing:
        recommendations.append(f'Consider incorporating relevant missing keywords into your summary or skills: {", ".join(missing[:8])}.')
    if score < 70:
        recommendations.append('Create a targeted CV copy for this role so you can tailor your summary and experience without altering your original CV.')
    else:
        recommendations.append('Your CV already aligns well with the key terms in this job description.')
    return {
        'score': score,
        'matched_keywords': matched,
        'missing_keywords': missing,
        'recommendations': recommendations,
    }


@transaction.atomic
def create_tailored_cv(user, pk, data):
    source_project = _project(user, pk)
    source_doc, _ = Document.objects.get_or_create(project=source_project)
    job_description = str(data.get('job_description') or '').strip()
    match_info = match_job_description(user, pk, job_description) if len(job_description) >= 20 else {'missing_keywords': []}
    title = str(data.get('title') or f'{source_project.title[:170]} (Tailored)').strip()[:200]

    content = json.loads(json.dumps(source_doc.content if isinstance(source_doc.content, dict) else {}))
    design = json.loads(json.dumps(source_doc.design if isinstance(source_doc.design, dict) else {}))
    existing_skills = content.get('skills') if isinstance(content.get('skills'), list) else []
    existing_names = {str(s.get('name', '')).strip().lower() for s in existing_skills if isinstance(s, dict)}
    for idx, kw in enumerate(match_info['missing_keywords'][:6]):
        if kw.lower() not in existing_names:
            existing_skills.append({'id': f'tailored-{idx + 1}', 'name': kw, 'category': 'Role alignment'})
    content['skills'] = existing_skills

    new_proj = create_project(user, {
        'title': title,
        'kind': 'advanced_cv',
        'folder': source_project.folder_id,
        'content': content,
        'design': design,
    })
    return new_proj


def get_career_profile_payload(user):
    profile, _ = CareerProfile.objects.get_or_create(owner=user)
    return {
        'personal': {
            'name': f'{user.first_name} {user.last_name}'.strip(),
            'title': '',
            'email': user.email,
            'phone': '',
            'location': '',
            'website': '',
        },
        'summary': profile.summary,
        'experience': profile.experience if isinstance(profile.experience, list) else [],
        'education': profile.education if isinstance(profile.education, list) else [],
        'skills': profile.skills if isinstance(profile.skills, list) else [],
        'projects': profile.projects if isinstance(profile.projects, list) else [],
        'certifications': profile.certifications if isinstance(profile.certifications, list) else [],
    }


@transaction.atomic
def save_career_profile_payload(user, data):
    profile, _ = CareerProfile.objects.get_or_create(owner=user)
    if 'summary' in data and isinstance(data['summary'], str):
        profile.summary = data['summary'][:4000]
    for key in ('experience', 'education', 'skills', 'projects', 'certifications'):
        if key in data and isinstance(data[key], list):
            profile.save_list = data[key][:100]
            setattr(profile, key, profile.save_list)
    profile.save()
    return get_career_profile_payload(user)


@transaction.atomic
def import_profile_into_document(user, pk, sections=None):
    document = _locked(user, pk)
    vault = get_career_profile_payload(user)
    content = dict(document.content if isinstance(document.content, dict) else {})
    allowed = {'personal', 'summary', 'experience', 'education', 'skills', 'projects', 'certifications'}
    selected = set(sections) & allowed if isinstance(sections, list) and sections else allowed

    if 'personal' in selected:
        personal = dict(content.get('personal') if isinstance(content.get('personal'), dict) else {})
        for k, v in vault['personal'].items():
            if v and not personal.get(k):
                personal[k] = v
        content['personal'] = personal
    if 'summary' in selected and vault['summary']:
        content['summary'] = vault['summary']
    for key in ('experience', 'education', 'skills', 'projects', 'certifications'):
        if key in selected and vault[key]:
            content[key] = json.loads(json.dumps(vault[key]))

    document.content = content
    document.revision += 1
    document.save(update_fields=['content', 'revision'])
    document.project.save(update_fields=['updated_at'])
    Activity.objects.create(owner=user, project=document.project, title=document.project.title, action='imported profile')
    return document_payload(document.project, document)


def generate_project_files(project, document):
    from .source_export import project_sources
    return project_sources(document)


def build_export_zip_bytes(user, pk):
    project = _project(user, pk)
    document, _ = Document.objects.get_or_create(project=project)
    files = generate_project_files(project, document)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, body in files.items():
            zf.writestr(name, body)
        zf.writestr('assets/README.txt', f'Assets directory for {project.title}.\n')
    Activity.objects.create(owner=user, project=project, title=project.title, action='exported zip')
    return project, buf.getvalue()
