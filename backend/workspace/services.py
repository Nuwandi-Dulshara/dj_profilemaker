import uuid
from datetime import timedelta
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from .models import Activity, CareerProfile, Document, Folder, Project
from .serializers import ProjectCreateSerializer, ProjectSerializer, TRASH_RETENTION_DAYS


def career_summary(user):
    profile = CareerProfile.objects.filter(owner=user).first()
    sections = [{'key': 'personal', 'label': 'Personal details', 'complete': bool(user.first_name.strip() and user.last_name.strip() and user.email)}]
    for key, label in [('summary', 'Professional summary'), ('experience', 'Experience'), ('education', 'Education'), ('skills', 'Skills'), ('projects', 'Projects'), ('certifications', 'Certifications')]:
        value = getattr(profile, key, None)
        sections.append({'key': key, 'label': label, 'complete': bool(value.strip() if isinstance(value, str) else value)})
    completed = sum(s['complete'] for s in sections)
    return {'sections': sections, 'completed': completed, 'total': 7, 'percent': round(completed / 7 * 100)}


# ---------------------------------------------------------------------------
# Career Profile: the single shared source of professional information that
# the CV Builder and Cover Letter Builder import from.
# ---------------------------------------------------------------------------
PERSONAL_FIELDS = ['phone', 'location', 'professional_title', 'linkedin', 'github', 'portfolio', 'bio']
LIST_SECTION_FIELDS = {
    'experience': ['company', 'role', 'location', 'start_date', 'end_date', 'description'],
    'education': ['institution', 'degree', 'field', 'start_date', 'end_date', 'details'],
    'projects': ['name', 'link', 'technologies', 'description'],
    'certifications': ['name', 'issuer', 'date'],
}
LONG_TEXT_FIELDS = {'description', 'details', 'bio'}
MAX_LIST_ITEMS = 50
MAX_SKILLS = 100


def _clean_text(value, limit):
    return value.strip()[:limit] if isinstance(value, str) else ''


def _clean_list_section(key, value):
    if not isinstance(value, list):
        raise ValidationError({key: 'Must be a list.'})
    if len(value) > MAX_LIST_ITEMS:
        raise ValidationError({key: f'Add at most {MAX_LIST_ITEMS} entries.'})
    cleaned = []
    for item in value:
        if not isinstance(item, dict):
            raise ValidationError({key: 'Each entry must be an object.'})
        entry = {f: _clean_text(item.get(f), 5000 if f in LONG_TEXT_FIELDS else 300) for f in LIST_SECTION_FIELDS[key]}
        if key == 'experience':
            entry['current'] = bool(item.get('current'))
        if any(v for k, v in entry.items() if k != 'current'):
            cleaned.append(entry)
    return cleaned


def _clean_skills(value):
    if isinstance(value, str):
        value = [part for chunk in value.splitlines() for part in chunk.split(',')]
    if not isinstance(value, list):
        raise ValidationError({'skills': 'Must be a list.'})
    seen, cleaned = set(), []
    for raw in value:
        skill = _clean_text(raw, 60)
        if skill and skill.lower() not in seen:
            seen.add(skill.lower())
            cleaned.append(skill)
    if len(cleaned) > MAX_SKILLS:
        raise ValidationError({'skills': f'Add at most {MAX_SKILLS} skills.'})
    return cleaned


def career_profile_payload(user):
    profile = CareerProfile.objects.filter(owner=user).first()
    stored = profile.personal if profile and isinstance(profile.personal, dict) else {}
    personal = {'first_name': user.first_name, 'last_name': user.last_name, 'email': user.email}
    personal.update({f: stored.get(f, '') for f in PERSONAL_FIELDS})
    return {
        'personal': personal,
        'summary': profile.summary if profile else '',
        'experience': profile.experience if profile else [],
        'education': profile.education if profile else [],
        'skills': profile.skills if profile else [],
        'projects': profile.projects if profile else [],
        'certifications': profile.certifications if profile else [],
        'revision': profile.revision if profile else 0,
        'updated_at': profile.updated_at if profile else None,
        **career_summary(user),
    }


@transaction.atomic
def update_career_profile(user, data):
    """Apply a partial update. `revision` only increases when something really changed,
    which is how imported copies know they are out of date."""
    if not isinstance(data, dict):
        raise ValidationError({'detail': 'Send a JSON object.'})
    profile, _ = CareerProfile.objects.select_for_update().get_or_create(owner=user)
    changed = False

    if 'personal' in data:
        incoming = data['personal']
        if not isinstance(incoming, dict):
            raise ValidationError({'personal': 'Must be an object.'})
        stored = dict(profile.personal) if isinstance(profile.personal, dict) else {}
        for field in PERSONAL_FIELDS:
            if field in incoming:
                stored[field] = _clean_text(incoming[field], 2000 if field in LONG_TEXT_FIELDS else 300)
        if stored != profile.personal:
            profile.personal = stored
            changed = True
        name_changed = False
        for field in ('first_name', 'last_name'):
            if field in incoming:
                name = _clean_text(incoming[field], 150)
                if not name:
                    raise ValidationError({field: 'This field cannot be blank.'})
                if name != getattr(user, field):
                    setattr(user, field, name)
                    name_changed = True
        if name_changed:
            user.save(update_fields=['first_name', 'last_name'])
            changed = True

    if 'summary' in data:
        summary = _clean_text(data['summary'], 5000)
        if summary != profile.summary:
            profile.summary = summary
            changed = True

    for key in LIST_SECTION_FIELDS:
        if key in data:
            cleaned = _clean_list_section(key, data[key])
            if cleaned != getattr(profile, key):
                setattr(profile, key, cleaned)
                changed = True

    if 'skills' in data:
        skills = _clean_skills(data['skills'])
        if skills != profile.skills:
            profile.skills = skills
            changed = True

    if changed:
        profile.revision += 1
    profile.save()
    return career_profile_payload(user)


@transaction.atomic
def create_project(user, data):
    serializer = ProjectCreateSerializer(data=data, context={'user': user})
    serializer.is_valid(raise_exception=True)
    project = serializer.save(owner=user)
    content = data.get('content') if isinstance(data.get('content'), dict) else {}
    design = data.get('design') if isinstance(data.get('design'), dict) else {}
    Document.objects.create(project=project, content=content, design=design)
    Activity.objects.create(owner=user, project=project, title=project.title, action='created')
    return project


@transaction.atomic
def change_project(user, pk, action, data=None):
    query = Project.objects.select_for_update().filter(owner=user)
    if action in ('restore', 'permanent-delete'):
        query = query.filter(deleted_at__isnull=False)
    else:
        query = query.filter(deleted_at__isnull=True)
    project = get_object_or_404(query, pk=pk)
    if action == 'update':
        serializer = ProjectSerializer(project, data=data, partial=True, context={'user': user})
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data:
            return project
        project = serializer.save()
        activity = 'updated'
    elif action == 'duplicate':
        document = Document.objects.filter(project=project).first()
        custom_title = str(data.get('title', '')).strip()[:200] if isinstance(data, dict) else ''
        next_title = custom_title or f'{project.title[:190]} (copy)'
        project = Project.objects.create(owner=user, title=next_title, kind=project.kind, folder=project.folder)
        if document:
            Document.objects.create(project=project, schema_version=document.schema_version, content=document.content, design=document.design)
        activity = 'duplicated'
    elif action == 'create-variant':
        document = Document.objects.filter(project=project).first()
        base_project = project.parent_project if project.parent_project and project.parent_project.deleted_at is None else project
        raw_role = str(data.get('target_role', '')).strip()[:150] if isinstance(data, dict) else ''
        if not raw_role:
            raise ValidationError({'target_role': 'Enter a target job title or company for this CV version.'})
        custom_title = str(data.get('title', '')).strip()[:200] if isinstance(data, dict) else ''
        next_title = custom_title or f'{base_project.title[:140]} — {raw_role}'[:200]
        project = Project.objects.create(
            owner=user,
            title=next_title,
            kind=project.kind,
            folder=project.folder,
            parent_project=base_project,
            target_role=raw_role,
        )
        if document:
            Document.objects.create(project=project, schema_version=document.schema_version, content=document.content, design=document.design)
        activity = 'created'
    elif action == 'delete':
        project.deleted_at = timezone.now()
        project.save(update_fields=['deleted_at', 'updated_at'])
        activity = 'deleted'
    elif action == 'permanent-delete':
        title = project.title
        project.delete()
        Activity.objects.create(owner=user, project=None, title=title, action='permanently_deleted')
        return {'deleted': str(pk), 'title': title}
    else:
        if project.deleted_at is None:
            return project
        project.deleted_at = None
        project.save(update_fields=['deleted_at', 'updated_at'])
        activity = 'restored'
    Activity.objects.create(owner=user, project=project, title=project.title, action=activity)
    return project


@transaction.atomic
def bulk_change_projects(user, data):
    action = data.get('action')
    valid_actions = {'favorite', 'unfavorite', 'archive', 'unarchive', 'move', 'delete', 'restore', 'permanent-delete'}
    if action not in valid_actions:
        raise ValidationError({'action': 'Choose favorite, unfavorite, archive, unarchive, move, delete, restore, or permanent-delete.'})
    raw_ids = data.get('project_ids')
    if not isinstance(raw_ids, list) or not raw_ids or len(raw_ids) > 100:
        raise ValidationError({'project_ids': 'Select between 1 and 100 projects.'})

    parsed_ids = []
    for raw_id in raw_ids:
        try:
            parsed_ids.append(uuid.UUID(str(raw_id)))
        except (ValueError, TypeError):
            raise ValidationError({'project_ids': 'All project identifiers must be valid UUIDs.'})

    target_folder = None
    if action == 'move':
        folder_id = data.get('folder')
        if folder_id not in (None, ''):
            try:
                folder_uuid = uuid.UUID(str(folder_id))
            except (ValueError, TypeError):
                raise ValidationError({'folder': 'Invalid folder identifier.'})
            target_folder = Folder.objects.filter(owner=user, pk=folder_uuid).first()
            if not target_folder:
                raise ValidationError({'folder': 'Selected folder does not exist.'})

    query = Project.objects.select_for_update().filter(owner=user, id__in=parsed_ids)
    if action in ('restore', 'permanent-delete'):
        query = query.filter(deleted_at__isnull=False)
    else:
        query = query.filter(deleted_at__isnull=True)

    owned_projects = list(query)
    if not owned_projects:
        raise NotFound('No matching projects were found.')

    now = timezone.now()
    updated_ids = []
    activities = []
    projects_to_delete = []
    for project in owned_projects:
        if action == 'favorite':
            project.favorite = True
            project.save(update_fields=['favorite', 'updated_at'])
            act_label = 'updated'
        elif action == 'unfavorite':
            project.favorite = False
            project.save(update_fields=['favorite', 'updated_at'])
            act_label = 'updated'
        elif action == 'archive':
            project.archived = True
            project.save(update_fields=['archived', 'updated_at'])
            act_label = 'archived'
        elif action == 'unarchive':
            project.archived = False
            project.save(update_fields=['archived', 'updated_at'])
            act_label = 'unarchived'
        elif action == 'move':
            project.folder = target_folder
            project.save(update_fields=['folder', 'updated_at'])
            act_label = 'moved'
        elif action == 'delete':
            project.deleted_at = now
            project.save(update_fields=['deleted_at', 'updated_at'])
            act_label = 'deleted'
        elif action == 'permanent-delete':
            projects_to_delete.append(project)
            act_label = 'permanently_deleted'
        else:
            project.deleted_at = None
            project.save(update_fields=['deleted_at', 'updated_at'])
            act_label = 'restored'
        updated_ids.append(project.id)
        activities.append(Activity(owner=user, project=project, title=project.title, action=act_label))

    if action == 'permanent-delete':
        # Create activities first, then delete projects (activities will have project=NULL due to SET_NULL)
        Activity.objects.bulk_create(activities)
        Project.objects.filter(id__in=updated_ids).delete()
    else:
        Activity.objects.bulk_create(activities)
    updated_set = set(updated_ids)
    failed_ids = [pid for pid in parsed_ids if pid not in updated_set]
    return {
        'action': action,
        'updated_ids': [str(pid) for pid in updated_ids],
        'failed_ids': [str(pid) for pid in failed_ids],
        'updated_count': len(updated_ids),
    }


@transaction.atomic
def purge_expired_trash(user=None, days=TRASH_RETENTION_DAYS):
    """Permanently delete trashed projects older than `days` days."""
    cutoff = timezone.now() - timedelta(days=days)
    query = Project.objects.filter(deleted_at__isnull=False, deleted_at__lte=cutoff)
    if user is not None:
        query = query.filter(owner=user)
    expired = list(query.select_related('owner'))
    if not expired:
        return 0
    Activity.objects.bulk_create([
        Activity(owner=item.owner, project=None, title=item.title, action='permanently_deleted')
        for item in expired
    ])
    deleted_count, _ = Project.objects.filter(id__in=[item.id for item in expired]).delete()
    return len(expired) if deleted_count else 0


def get_project_versions(user, pk):
    """Return the base CV and all active job-specific variants linked to it, including document files for comparison."""
    current = get_object_or_404(
        Project.objects.select_related('parent_project'),
        pk=pk,
        owner=user,
        deleted_at__isnull=True,
    )
    base = current.parent_project if current.parent_project and current.parent_project.deleted_at is None else current
    versions_qs = (
        Project.objects.filter(owner=user, deleted_at__isnull=True)
        .filter(id=base.id)
        .union(
            Project.objects.filter(owner=user, deleted_at__isnull=True, parent_project=base)
        )
    )
    # Re-fetch ordered with documents attached cleanly
    version_ids = [item.id for item in versions_qs]
    ordered = (
        Project.objects.filter(id__in=version_ids)
        .select_related('document')
        .order_by('created_at', 'id')
    )
    items = []
    for proj in ordered:
        doc = getattr(proj, 'document', None)
        raw_files = doc.content.get('files', {}) if doc and isinstance(doc.content, dict) else {}
        items.append({
            'id': str(proj.id),
            'title': proj.title,
            'target_role': proj.target_role,
            'is_base': proj.id == base.id,
            'is_current': proj.id == current.id,
            'updated_at': proj.updated_at,
            'files': raw_files if isinstance(raw_files, dict) else {},
        })
    return {
        'base_id': str(base.id),
        'current_id': str(current.id),
        'versions': items,
    }
