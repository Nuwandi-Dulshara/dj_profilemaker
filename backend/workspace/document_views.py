import re
from django.http import HttpResponse
from rest_framework.response import Response
from . import documents
from .models import Document
from .serializers import ProjectSerializer
from .services import create_project
from .views import PrivateView


class AdvancedCvCreateView(PrivateView):
    def post(self, request):
        data = dict(request.data)
        data['kind'] = 'advanced_cv'
        content = data.get('content') if isinstance(data.get('content'), dict) else {}
        design = data.get('design') if isinstance(data.get('design'), dict) else {}
        documents.validate_payload(content, design)
        project = create_project(request.user, data)
        return Response(ProjectSerializer(project).data, status=201)


class ProjectDocumentView(PrivateView):
    def get(self, request, pk):
        return Response(documents.load_document(request.user, pk))

    def put(self, request, pk):
        try:
            return Response(documents.save_document(request.user, pk, request.data))
        except documents.RevisionConflict as exc:
            current = Document.objects.filter(project_id=pk, project__owner=request.user).values_list('revision', flat=True).first()
            return Response({'detail': str(exc.detail), 'revision': current}, status=409)


class ProjectVersionsView(PrivateView):
    def get(self, request, pk):
        return Response(documents.list_versions(request.user, pk))

    def post(self, request, pk):
        return Response(documents.create_version(request.user, pk, request.data.get('name')), status=201)


class ProjectVersionRestoreView(PrivateView):
    def post(self, request, pk, version_id):
        return Response(documents.restore_version(request.user, pk, version_id))


class ProjectAtsAnalysisView(PrivateView):
    def get(self, request, pk):
        return Response(documents.analyze_ats(request.user, pk))


class ProjectContentAnalysisView(PrivateView):
    def get(self, request, pk):
        return Response(documents.analyze_content(request.user, pk))


class ProjectJobMatchView(PrivateView):
    def post(self, request, pk):
        return Response(documents.match_job_description(request.user, pk, request.data.get('job_description')))


class ProjectTailoredCvView(PrivateView):
    def post(self, request, pk):
        project = documents.create_tailored_cv(request.user, pk, request.data)
        return Response(ProjectSerializer(project).data, status=201)


class CareerProfileDetailView(PrivateView):
    def get(self, request):
        return Response(documents.get_career_profile_payload(request.user))

    def put(self, request):
        return Response(documents.save_career_profile_payload(request.user, request.data))


class ProjectImportProfileView(PrivateView):
    def post(self, request, pk):
        return Response(documents.import_profile_into_document(request.user, pk, request.data.get('sections')))


class ProjectFilesView(PrivateView):
    def get(self, request, pk):
        project = documents._project(request.user, pk)
        document, _ = Document.objects.get_or_create(project=project)
        return Response({'files': documents.generate_project_files(project, document)})


class ProjectExportZipView(PrivateView):
    def get(self, request, pk):
        project, zip_bytes = documents.build_export_zip_bytes(request.user, pk)
        slug = re.sub(r'[^a-zA-Z0-9_-]+', '-', project.title).strip('-') or 'cv-project'
        response = HttpResponse(zip_bytes, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{slug}.zip"'
        return response
