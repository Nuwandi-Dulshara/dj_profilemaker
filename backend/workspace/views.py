import base64
import io
import posixpath
import secrets
import uuid
import zipfile
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum, F, Func, BigIntegerField, TextField
from django.db.models.functions import Cast, Lower
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Activity, Document, DocumentSnapshot, ExportEvent, Folder, Notification, Project, PublicShareLink
from .serializers import (
    ActivitySerializer,
    DocumentSnapshotSerializer,
    ExportEventSerializer,
    FolderSerializer,
    NotificationSerializer,
    ProjectSerializer,
    PublicShareLinkSerializer,
)
from .services import (
    bulk_change_projects,
    career_profile_payload,
    career_summary,
    change_project,
    create_project,
    get_project_versions,
    purge_expired_trash,
    update_career_profile,
)


class Pagination(PageNumberPagination):
    page_size = 6
    page_size_query_param = 'page_size'
    max_page_size = 50


@method_decorator(never_cache, name='dispatch')
class PrivateView(APIView):
    def page(self, query, serializer, request, **extra):
        pagination = Pagination()
        items = pagination.paginate_queryset(query, request)
        response = pagination.get_paginated_response(serializer(items, many=True).data)
        response.data.update(extra)
        return response


def get_project_stats(user):
    projects = Project.objects.filter(owner=user)
    active = Q(deleted_at__isnull=True)
    counts = projects.aggregate(
        total=Count('id', filter=active),
        advanced_cv=Count('id', filter=active & Q(kind='advanced_cv')),
        cover_letter=Count('id', filter=active & Q(kind='cover_letter')),
        deleted=Count('id', filter=Q(deleted_at__isnull=False)),
    )
    extra = projects.aggregate(
        active=Count('id', filter=active & Q(archived=False)),
        favorites=Count('id', filter=active & Q(favorite=True)),
        archived=Count('id', filter=active & Q(archived=True)),
    )
    return counts, {**counts, **extra}


class SummaryView(PrivateView):
    def get(self, request):
        purge_expired_trash(user=request.user)
        counts, project_stats = get_project_stats(request.user)
        return Response({
            'counts': counts,
            'project_stats': project_stats,
            'profile': career_summary(request.user),
            'workflows': {'advanced_cv': True, 'cover_letter': True, 'profile': True},
        })


class CareerProfileView(PrivateView):
    """Shared source of professional information for the CV and cover letter builders."""

    def get(self, request):
        return Response(career_profile_payload(request.user))

    def put(self, request):
        return Response(update_career_profile(request.user, request.data))


class RecentProjectsView(PrivateView):
    def get(self, request):
        purge_expired_trash(user=request.user)
        state = request.query_params.get('state', 'active')
        if state not in ['active', 'archived', 'deleted', 'all']:
            raise ValidationError({'state': 'Choose active, archived, or deleted.'})
        projects = Project.objects.filter(owner=request.user).select_related('folder', 'parent_project').annotate(
            active_variant_count=Count('variants', filter=Q(variants__deleted_at__isnull=True))
        )
        if state == 'deleted':
            projects = projects.filter(deleted_at__isnull=False)
        elif state == 'all':
            projects = projects.filter(deleted_at__isnull=True)
        else:
            projects = projects.filter(deleted_at__isnull=True, archived=state == 'archived')

        kind = request.query_params.get('kind', '').strip()
        if kind and kind != 'all':
            if kind not in ['advanced_cv', 'cover_letter']:
                raise ValidationError({'kind': 'Choose advanced_cv or cover_letter.'})
            projects = projects.filter(kind=kind)

        favorite = request.query_params.get('favorite', '').strip().lower()
        if favorite in ['true', '1']:
            projects = projects.filter(favorite=True)
        elif favorite in ['false', '0']:
            projects = projects.filter(favorite=False)

        folder = request.query_params.get('folder', '').strip()
        if folder in ['none', 'root', 'unfiled']:
            projects = projects.filter(folder__isnull=True)
        elif folder and folder != 'all':
            try:
                folder_uuid = uuid.UUID(folder)
            except ValueError:
                raise ValidationError({'folder': 'Invalid folder identifier.'})
            projects = projects.filter(folder_id=folder_uuid)

        search = request.query_params.get('search', '').strip()[:200]
        if search:
            projects = projects.filter(title__icontains=search)

        ordering = request.query_params.get('ordering', '-updated_at').strip()
        order_map = {
            '-updated_at': ('-updated_at', '-id'),
            'updated_at': ('updated_at', 'id'),
            '-created_at': ('-created_at', '-id'),
            'created_at': ('created_at', 'id'),
            'title': (Lower('title'), 'id'),
            '-title': (Lower('title').desc(), '-id'),
            'kind': ('kind', '-updated_at', '-id'),
        }
        if ordering not in order_map:
            raise ValidationError({'ordering': 'Unsupported sort order.'})
        projects = projects.order_by(*order_map[ordering])

        _, project_stats = get_project_stats(request.user)
        return self.page(projects, ProjectSerializer, request, stats=project_stats)

    def post(self, request):
        project = create_project(request.user, request.data)
        return Response(ProjectSerializer(project).data, status=201)


class ActivityView(PrivateView):
    def get(self, request):
        return self.page(Activity.objects.filter(owner=request.user), ActivitySerializer, request)


class StorageView(PrivateView):
    def get(self, request):
        # Logical bytes of stored JSON, not physical database or disk usage.
        content_bytes = Func(Cast(F('content'), TextField()), function='OCTET_LENGTH', output_field=BigIntegerField())
        design_bytes = Func(Cast(F('design'), TextField()), function='OCTET_LENGTH', output_field=BigIntegerField())
        used = Document.objects.filter(project__owner=request.user).aggregate(total=Sum(content_bytes + design_bytes))['total'] or 0
        return Response({'used_bytes': used, 'quota_bytes': getattr(settings, 'DOCUMENT_STORAGE_QUOTA_BYTES', None), 'scope': 'Stored document data, including archived and deleted projects. Excludes database overhead and backups.'})


class ProjectDetailView(PrivateView):
    def get(self, request, pk):
        project = get_object_or_404(Project.objects.select_related('folder'), pk=pk, owner=request.user)
        return Response(ProjectSerializer(project).data)

    def patch(self, request, pk):
        return Response(ProjectSerializer(change_project(request.user, pk, 'update', request.data)).data)

    def delete(self, request, pk):
        return Response(ProjectSerializer(change_project(request.user, pk, 'delete')).data)


class ProjectActionView(PrivateView):
    def post(self, request, pk, action):
        result = change_project(request.user, pk, action, request.data)
        if action == 'permanent-delete':
            return Response(result)
        return Response(ProjectSerializer(result).data, status=201 if action in ('duplicate', 'create-variant') else 200)


class ProjectVersionsView(PrivateView):
    def get(self, request, pk):
        return Response(get_project_versions(request.user, pk))


class ProjectBulkActionsView(PrivateView):
    def post(self, request):
        return Response(bulk_change_projects(request.user, request.data))


def annotated_folders(user):
    return Folder.objects.filter(owner=user).select_related('parent').annotate(
        project_count=Count('project', filter=Q(project__deleted_at__isnull=True, project__archived=False))
    )


class FoldersView(PrivateView):
    def get(self, request):
        return Response(FolderSerializer(annotated_folders(request.user), many=True).data)

    def post(self, request):
        serializer = FolderSerializer(data=request.data, context={'user': request.user})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                folder = serializer.save(owner=request.user)
        except IntegrityError:
            raise ValidationError({'name': 'A folder with this name already exists.'})
        return Response(FolderSerializer(annotated_folders(request.user).get(pk=folder.pk)).data, status=201)


class FolderDetailView(PrivateView):
    def patch(self, request, pk):
        folder = get_object_or_404(Folder, pk=pk, owner=request.user)
        serializer = FolderSerializer(folder, data=request.data, partial=True, context={'user': request.user})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            raise ValidationError({'name': 'A folder with this name already exists.'})
        return Response(FolderSerializer(annotated_folders(request.user).get(pk=folder.pk)).data)

    def delete(self, request, pk):
        with transaction.atomic():
            folder = get_object_or_404(Folder.objects.select_for_update(), pk=pk, owner=request.user)
            Project.objects.filter(owner=request.user, folder=folder).update(folder=folder.parent)
            Folder.objects.filter(owner=request.user, parent=folder).update(parent=folder.parent)
            folder.delete()
        return Response({'deleted': str(pk)})


class ProjectDocumentView(PrivateView):
    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk, owner=request.user, deleted_at__isnull=True)
        document, _ = Document.objects.get_or_create(project=project)
        return Response({
            'project': ProjectSerializer(project).data,
            'content': document.content if isinstance(document.content, dict) else {},
            'design': document.design if isinstance(document.design, dict) else {},
            'revision': document.revision,
            'schema_version': document.schema_version,
        })

    def put(self, request, pk):
        with transaction.atomic():
            project = get_object_or_404(Project.objects.select_for_update(), pk=pk, owner=request.user, deleted_at__isnull=True)
            document, _ = Document.objects.select_for_update().get_or_create(project=project)

            title = request.data.get('title')
            if isinstance(title, str) and title.strip() and title.strip() != project.title:
                project.title = title.strip()[:200]

            content = request.data.get('content')
            if content is not None:
                if not isinstance(content, dict):
                    raise ValidationError({'content': 'Content must be an object.'})
                document.content = content

            design = request.data.get('design')
            if design is not None:
                if not isinstance(design, dict):
                    raise ValidationError({'design': 'Design must be an object.'})
                document.design = design

            document.revision += 1
            document.save(update_fields=['content', 'design', 'revision'])
            project.save(update_fields=['title', 'updated_at'])
            DocumentSnapshot.objects.create(
                project=project,
                revision=document.revision,
                title=project.title,
                content=document.content if isinstance(document.content, dict) else {},
                design=document.design if isinstance(document.design, dict) else {},
            )
            Activity.objects.create(owner=request.user, project=project, title=project.title, action='updated')

        return Response({
            'project': ProjectSerializer(project).data,
            'content': document.content,
            'design': document.design,
            'revision': document.revision,
            'schema_version': document.schema_version,
        })


SUPPORTED_ZIP_TEXT_EXTS = {'.jsx', '.js', '.tsx', '.ts', '.css', '.json', '.html', '.md', '.txt'}
SUPPORTED_ZIP_IMAGE_MIMES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
}


class ProjectUploadZipView(PrivateView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': 'Attach a ZIP archive.'})
        if upload.size > 5 * 1024 * 1024:
            raise ValidationError({'file': 'ZIP archive must be 5 MB or smaller.'})

        raw_bytes = upload.read()
        try:
            zf = zipfile.ZipFile(io.BytesIO(raw_bytes))
        except zipfile.BadZipFile:
            raise ValidationError({'file': 'Invalid ZIP archive.'})

        extracted_files = {}
        extracted_folders = set()
        total_uncompressed = 0

        with zf:
            infos = zf.infolist()
            if len(infos) > 150:
                raise ValidationError({'file': 'ZIP archive contains too many entries (maximum 150).'})
            for info in infos:
                raw_name = info.filename.replace('\\', '/').strip('/')
                if not raw_name or raw_name.startswith('__MACOSX') or raw_name.endswith('.DS_Store'):
                    continue
                norm = posixpath.normpath(raw_name).strip('/')
                if not norm or norm == '.' or norm.startswith('..') or '/..' in norm:
                    raise ValidationError({'file': f'Unsafe path in ZIP archive: {info.filename}'})

                parts = norm.split('/')
                for i in range(1, len(parts)):
                    extracted_folders.add('/'.join(parts[:i]))

                if info.is_dir() or info.filename.endswith('/'):
                    extracted_folders.add(norm)
                    continue

                total_uncompressed += info.file_size
                if total_uncompressed > 5 * 1024 * 1024:
                    raise ValidationError({'file': 'Extracted ZIP contents exceed 5 MB limit.'})

                dot = norm.rfind('.')
                ext = norm[dot:].lower() if dot != -1 else ''
                if ext in SUPPORTED_ZIP_TEXT_EXTS:
                    try:
                        extracted_files[norm] = zf.read(info).decode('utf-8')
                    except UnicodeDecodeError:
                        continue
                elif ext in SUPPORTED_ZIP_IMAGE_MIMES:
                    b64 = base64.b64encode(zf.read(info)).decode('ascii')
                    extracted_files[norm] = f'data:{SUPPORTED_ZIP_IMAGE_MIMES[ext]};base64,{b64}'

        with transaction.atomic():
            project = get_object_or_404(Project.objects.select_for_update(), pk=pk, owner=request.user, deleted_at__isnull=True)
            document, _ = Document.objects.select_for_update().get_or_create(project=project)
            content = document.content if isinstance(document.content, dict) else {}
            current_files = dict(content.get('files')) if isinstance(content.get('files'), dict) else {}
            current_folders = set(content.get('folders')) if isinstance(content.get('folders'), list) else set()

            current_files.update(extracted_files)
            current_folders.update(extracted_folders)

            document.content = {
                **content,
                'files': current_files,
                'folders': sorted(current_folders),
            }
            document.revision += 1
            document.save(update_fields=['content', 'revision'])
            project.save(update_fields=['updated_at'])
            Activity.objects.create(owner=request.user, project=project, title=project.title, action='uploaded zip')

        return Response({
            'project': ProjectSerializer(project).data,
            'content': document.content,
            'design': document.design,
            'revision': document.revision,
            'extracted_count': len(extracted_files),
        })


class NotificationsView(PrivateView):
    def get(self, request):
        query = Notification.objects.filter(owner=request.user)
        return self.page(query, NotificationSerializer, request, unread_count=query.filter(is_read=False).count())


class NotificationDetailView(PrivateView):
    def patch(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, owner=request.user)
        serializer = NotificationSerializer(notification, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class NotificationsReadAllView(PrivateView):
    def post(self, request):
        count = Notification.objects.filter(owner=request.user, is_read=False).update(is_read=True)
        return Response({'updated': count})


class ProjectSnapshotsView(PrivateView):
    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk, owner=request.user, deleted_at__isnull=True)
        snapshots = project.snapshots.all()[:50]
        return Response({'snapshots': DocumentSnapshotSerializer(snapshots, many=True).data})


class ProjectSnapshotRestoreView(PrivateView):
    def post(self, request, pk, snapshot_id):
        with transaction.atomic():
            project = get_object_or_404(Project.objects.select_for_update(), pk=pk, owner=request.user, deleted_at__isnull=True)
            snapshot = get_object_or_404(DocumentSnapshot, pk=snapshot_id, project=project)
            document, _ = Document.objects.select_for_update().get_or_create(project=project)

            project.title = snapshot.title[:200] or project.title
            document.content = snapshot.content if isinstance(snapshot.content, dict) else {}
            document.design = snapshot.design if isinstance(snapshot.design, dict) else {}
            document.revision += 1
            document.save(update_fields=['content', 'design', 'revision'])
            project.save(update_fields=['title', 'updated_at'])
            DocumentSnapshot.objects.create(
                project=project,
                revision=document.revision,
                title=project.title,
                content=document.content,
                design=document.design,
            )
            Activity.objects.create(owner=request.user, project=project, title=project.title, action='restored')

        return Response({
            'project': ProjectSerializer(project).data,
            'content': document.content,
            'design': document.design,
            'revision': document.revision,
            'restored_from_revision': snapshot.revision,
        })


class ProjectShareView(PrivateView):
    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk, owner=request.user, deleted_at__isnull=True)
        link = PublicShareLink.objects.filter(project=project, is_active=True).first()
        return Response({'share': PublicShareLinkSerializer(link).data if link else None})

    def post(self, request, pk):
        project = get_object_or_404(Project, pk=pk, owner=request.user, deleted_at__isnull=True)
        link, created = PublicShareLink.objects.get_or_create(
            project=project,
            defaults={'token': secrets.token_urlsafe(18), 'is_active': True},
        )
        if not created and not link.is_active:
            link.token = secrets.token_urlsafe(18)
            link.is_active = True
            link.save(update_fields=['token', 'is_active', 'updated_at'])
        return Response({'share': PublicShareLinkSerializer(link).data}, status=201 if created else 200)

    def delete(self, request, pk):
        project = get_object_or_404(Project, pk=pk, owner=request.user, deleted_at__isnull=True)
        PublicShareLink.objects.filter(project=project).update(is_active=False)
        return Response({'share': None})


@method_decorator(never_cache, name='dispatch')
class PublicShareDetailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        link = get_object_or_404(
            PublicShareLink.objects.select_related('project', 'project__document'),
            token=token,
            is_active=True,
            project__deleted_at__isnull=True,
        )
        project = link.project
        document = getattr(project, 'document', None)
        return Response({
            'title': project.title,
            'kind': project.kind,
            'updated_at': project.updated_at,
            'content': document.content if document and isinstance(document.content, dict) else {},
            'design': document.design if document and isinstance(document.design, dict) else {},
        })


class ProjectExportsView(PrivateView):
    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk, owner=request.user, deleted_at__isnull=True)
        events = project.export_events.all()[:30]
        pdf_count = project.export_events.filter(format='pdf').count()
        docx_count = project.export_events.filter(format='docx').count()
        return Response({
            'pdf_count': pdf_count,
            'docx_count': docx_count,
            'total_count': pdf_count + docx_count,
            'events': ExportEventSerializer(events, many=True).data,
        })

    def post(self, request, pk):
        project = get_object_or_404(Project, pk=pk, owner=request.user, deleted_at__isnull=True)
        fmt = str(request.data.get('format', '')).strip().lower()
        if fmt not in ('pdf', 'docx'):
            raise ValidationError({'format': 'Choose pdf or docx.'})
        event = ExportEvent.objects.create(project=project, owner=request.user, format=fmt)
        pdf_count = project.export_events.filter(format='pdf').count()
        docx_count = project.export_events.filter(format='docx').count()
        return Response({
            'event': ExportEventSerializer(event).data,
            'pdf_count': pdf_count,
            'docx_count': docx_count,
            'total_count': pdf_count + docx_count,
        }, status=201)
