import uuid
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from .models import Activity, CareerProfile, Document, Folder, Project
from .serializers import ProjectCreateSerializer, ProjectSerializer


def career_summary(user):
    profile = CareerProfile.objects.filter(owner=user).first()
    sections = [{'key': 'personal', 'label': 'Personal details', 'complete': bool(user.first_name.strip() and user.last_name.strip() and user.email)}]
    for key, label in [('summary', 'Professional summary'), ('experience', 'Experience'), ('education', 'Education'), ('skills', 'Skills'), ('projects', 'Projects'), ('certifications', 'Certifications')]:
        value = getattr(profile, key, None)
        sections.append({'key': key, 'label': label, 'complete': bool(value.strip() if isinstance(value, str) else value)})
    completed = sum(s['complete'] for s in sections)
    return {'sections': sections, 'completed': completed, 'total': 7, 'percent': round(completed / 7 * 100)}


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
    if action != 'restore':
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
        project = Project.objects.create(owner=user, title=f'{project.title[:190]} (copy)', kind=project.kind, folder=project.folder)
        if document:
            Document.objects.create(project=project, schema_version=document.schema_version, content=document.content, design=document.design)
        activity = 'duplicated'
    elif action == 'delete':
        project.deleted_at = timezone.now()
        project.save(update_fields=['deleted_at', 'updated_at'])
        activity = 'deleted'
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
    valid_actions = {'favorite', 'unfavorite', 'archive', 'unarchive', 'move', 'delete', 'restore'}
    if action not in valid_actions:
        raise ValidationError({'action': 'Choose favorite, unfavorite, archive, unarchive, move, delete, or restore.'})
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
    if action == 'restore':
        query = query.filter(deleted_at__isnull=False)
    else:
        query = query.filter(deleted_at__isnull=True)

    owned_projects = list(query)
    if not owned_projects:
        raise NotFound('No matching projects were found.')

    now = timezone.now()
    updated_ids = []
    activities = []
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
        else:
            project.deleted_at = None
            project.save(update_fields=['deleted_at', 'updated_at'])
            act_label = 'restored'
        updated_ids.append(project.id)
        activities.append(Activity(owner=user, project=project, title=project.title, action=act_label))

    Activity.objects.bulk_create(activities)
    updated_set = set(updated_ids)
    failed_ids = [pid for pid in parsed_ids if pid not in updated_set]
    return {
        'action': action,
        'updated_ids': [str(pid) for pid in updated_ids],
        'failed_ids': [str(pid) for pid in failed_ids],
        'updated_count': len(updated_ids),
    }
