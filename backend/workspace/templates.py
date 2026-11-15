"""Trusted presets and owner-scoped, configuration-only template services."""
from copy import deepcopy
import hashlib
import json
import uuid
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from .documents import validate_payload, get_career_profile_payload, _locked, document_payload, RevisionConflict
from .models import SavedTemplate, TemplatePreference, TemplateCreation, DocumentVersion
from .services import create_project

BASE = {'pageSize': 'A4', 'fontFamily': 'Arial', 'fontSize': 11, 'margin': 18, 'accent': '#0B1F3A', 'textColor': '#111827', 'lineHeight': 1.45, 'sectionSpacing': 1, 'layout': 'single', 'headingStyle': 'line', 'headerStyle': 'left', 'headings': {}, 'pageBreaks': [], 'order': ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'achievements', 'publications', 'languages', 'volunteering', 'references', 'custom'], 'hidden': []}
PRESETS = [
    ('classic-ats', 'Classic ATS', ['ATS-Friendly', 'Professional'], ['Business Analyst', 'Accountant'], {}),
    ('simple-professional', 'Simple Professional', ['ATS-Friendly', 'Professional', 'Minimalist'], ['Business Analyst', 'Accountant'], {'headingStyle': 'plain', 'fontFamily': 'Calibri'}),
    ('clean-graduate', 'Clean Graduate', ['ATS-Friendly', 'Minimalist'], ['Fresh Graduate'], {'accent': '#334155', 'headerStyle': 'center'}),
    ('executive-standard', 'Executive Standard', ['ATS-Friendly', 'Professional'], ['Executive'], {'fontFamily': 'Georgia', 'headerStyle': 'center', 'fontSize': 12}),
    ('modern-navy', 'Modern Navy', ['Modern', 'Professional'], ['Business Analyst', 'Executive'], {'headerStyle': 'banner', 'headingStyle': 'band'}),
    ('minimal-green', 'Minimal Green', ['Modern', 'Minimalist'], ['Accountant', 'Fresh Graduate'], {'accent': '#166534', 'headingStyle': 'plain', 'sectionSpacing': 1.5}),
    ('contemporary-professional', 'Contemporary Professional', ['Modern', 'Professional'], ['Business Analyst'], {'layout': 'two-column', 'accent': '#334155', 'headingStyle': 'band'}),
    ('technical-developer', 'Technical Developer', ['Modern', 'Professional'], ['Software Engineer'], {'layout': 'two-column', 'accent': '#1D4ED8', 'fontFamily': 'Calibri'}),
    ('creative-sidebar', 'Creative Sidebar', ['Creative', 'Modern'], ['Designer'], {'layout': 'sidebar', 'accent': '#6D28D9', 'headerStyle': 'banner'}),
    ('elegant-portfolio', 'Elegant Portfolio', ['Creative', 'Minimalist'], ['Designer'], {'layout': 'sidebar', 'accent': '#9F1239', 'fontFamily': 'Georgia', 'headingStyle': 'plain', 'headerStyle': 'center'}),
    ('academic-research', 'Academic Research CV', ['Academic', 'Professional'], ['Researcher'], {'fontFamily': 'Times New Roman', 'fontSize': 12, 'headingStyle': 'plain', 'order': ['summary', 'education', 'publications', 'experience', 'projects', 'achievements', 'skills', 'certifications', 'languages', 'volunteering', 'references', 'custom']}),
    ('teacher-professional', 'Teacher Professional CV', ['Professional', 'ATS-Friendly'], ['Teacher'], {'accent': '#0F766E', 'fontFamily': 'Verdana', 'headerStyle': 'center', 'headingStyle': 'band'}),
]


def metadata(tid, name, description, design, custom=False, categories=None, careers=None):
    layout = design.get('layout', 'single')
    return {'id': str(tid), 'name': name, 'description': description, 'categories': categories or ['Professional'], 'careers': careers or [], 'layout': layout, 'ats_risk': 'low' if layout == 'single' else 'medium', 'ats_notes': 'Standard text and linear reading order; screening acceptance is not guaranteed.' if layout == 'single' else 'Columns may affect extraction and reading order. Check exported text; screening acceptance is not guaranteed.', 'design': design, 'favorite': False, 'last_used_at': None, 'is_custom': custom}


def original_templates():
    return [metadata(tid, name, f'{name}: a {settings.get("layout", "single")} CV layout with editable sections.', {**deepcopy(BASE), **deepcopy(settings), 'templateId': tid}, categories=categories, careers=careers) for tid, name, categories, careers, settings in PRESETS]


def custom_metadata(saved):
    return metadata(saved.id, saved.name, saved.description, deepcopy(saved.design), True)


def resolve_template(user, tid):
    for item in original_templates():
        if item['id'] == str(tid):
            return item
    try:
        pk = uuid.UUID(str(tid))
    except (ValueError, TypeError):
        raise NotFound('Template not found.')
    return custom_metadata(get_object_or_404(SavedTemplate, owner=user, pk=pk))


def personalize(user, items):
    preferences = {p.template_id: p for p in TemplatePreference.objects.filter(owner=user)}
    for item in items:
        pref = preferences.get(item['id'])
        if pref:
            item.update(favorite=pref.favorite, last_used_at=pref.last_used_at)
    return items


def validated_custom(data, instance=None):
    unknown = set(data) - {'name', 'description', 'design'}
    if unknown:
        raise ValidationError({'detail': 'Only name, description and design may be saved.'})
    name = data.get('name', instance.name if instance else '')
    description = data.get('description', instance.description if instance else '')
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
        raise ValidationError({'name': 'Enter a name of 1 to 120 characters.'})
    if not isinstance(description, str) or len(description) > 500:
        raise ValidationError({'description': 'Use at most 500 characters.'})
    design = data.get('design', instance.design if instance else None)
    validate_payload({}, design)
    allowed = set(BASE) | {'templateId'}
    if set(design) - allowed:
        raise ValidationError({'design': 'Only supported design settings may be saved.'})
    return {'name': name.strip(), 'description': description, 'design': deepcopy(design)}


def mark_used(user, tid):
    TemplatePreference.objects.update_or_create(owner=user, template_id=tid, defaults={'last_used_at': timezone.now()})


@transaction.atomic
def create_from_template(user, data):
    try:
        key = uuid.UUID(str(data.get('idempotency_key')))
    except (ValueError, TypeError):
        raise ValidationError({'idempotency_key': 'Send a UUID for safe creation retries.'})
    if not isinstance(data.get('import_profile', False), bool):
        raise ValidationError({'import_profile': 'Send a boolean.'})
    overrides = data.get('design', {})
    validate_payload({}, overrides)
    if set(overrides) - (set(BASE) | {'templateId'}):
        raise ValidationError({'design': 'Only supported design settings may be saved.'})
    # Serialize creation per owner so parallel retries cannot create two projects.
    get_user_model().objects.select_for_update().get(pk=user.pk)
    fingerprint = hashlib.sha256(json.dumps({'title': data.get('title'), 'template_id': data.get('template_id'), 'import_profile': data.get('import_profile', False), 'folder': data.get('folder'), 'design': overrides}, sort_keys=True).encode()).hexdigest()
    previous = TemplateCreation.objects.filter(owner=user, key=key).select_related('project').first()
    if previous:
        if previous.fingerprint != fingerprint:
            raise RevisionConflict('This creation key was already used with different settings.')
        return previous.project, False
    template = resolve_template(user, data.get('template_id'))
    content = get_career_profile_payload(user) if data.get('import_profile') else {}
    design = {**template['design'], **deepcopy(overrides), 'templateId': template['id']}
    validate_payload(content, design)
    project = create_project(user, {'kind': 'template_cv', 'title': data.get('title'), 'folder': data.get('folder'), 'content': content, 'design': design})
    TemplateCreation.objects.create(owner=user, key=key, fingerprint=fingerprint, project=project)
    mark_used(user, template['id'])
    return project, True


@transaction.atomic
def switch_template(user, pk, data):
    revision = data.get('revision')
    if isinstance(revision, bool) or not isinstance(revision, int):
        raise ValidationError({'revision': 'Send the revision you are editing.'})
    document = _locked(user, pk)
    if document.project.kind not in ['advanced_cv', 'template_cv']:
        raise ValidationError({'detail': 'Only CV projects support CV templates.'})
    if revision != document.revision:
        raise RevisionConflict()
    template = resolve_template(user, data.get('template_id'))
    overrides = data.get('design', {})
    validate_payload({}, overrides)
    if set(overrides) - (set(BASE) | {'templateId'}):
        raise ValidationError({'design': 'Only supported design settings may be saved.'})
    next_design = {**template['design'], **deepcopy(overrides), 'templateId': template['id']}
    validate_payload({}, next_design)
    DocumentVersion.objects.create(document=document, name='Before switching template', content=document.content, design=document.design, revision=document.revision)
    document.design = next_design
    document.revision += 1
    document.save(update_fields=['design', 'revision'])
    document.project.save(update_fields=['updated_at'])
    mark_used(user, template['id'])
    return document_payload(document.project, document)
