from pathlib import Path
from django.conf import settings
from django.db import transaction
from django.contrib.sessions.models import Session
from django.contrib.sessions.backends.db import SessionStore
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.http import content_disposition_header
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from .views import CvView
from .assets import AssetDrive
from .cloud import revision
from .errors import CvError
from .extraction import text_source
from .extraction_runner import extract_upload
from .models import CvAsset, CvRevision, AnalysisRun, SuggestionRun
from .serializers import SourceSerializer


def source_input(data):
    if not isinstance(data, dict):
        raise CvError('Send a JSON object containing the CV source.')
    serializer = SourceSerializer(data=data.get('source', {}))
    serializer.is_valid(raise_exception=True)
    source = dict(serializer.validated_data)
    if len(source['html']) + len(source['css']) > 2_000_000:
        raise CvError('Analysis supports up to 2 million source characters.')
    return source


def text_input(data, key, limit=30000):
    if not isinstance(data, dict):
        raise CvError('Send a JSON object.')
    value = data.get(key, '')
    if not isinstance(value, str) or len(value) > limit:
        raise CvError(f'{key} must be text with at most {limit} characters.')
    return value


def upload_input(request):
    upload = request.FILES.get('file')
    if not upload or upload.size > settings.CV_UPLOAD_MAX_BYTES:
        raise CvError('Choose a file within the configured upload size limit.')
    return upload, upload.read()


def asset_data(asset):
    return {'id': str(asset.pk), 'name': asset.name, 'fileId': asset.file_id,
            'createdAt': asset.created_at.isoformat(), **asset.extraction}


class LocalCvView(CvView):
    # No OAuth changes: do not hold a session lock during CPU work or AI requests.
    def dispatch(self, request, *args, **kwargs):
        return APIView.dispatch(self, request, *args, **kwargs)


def cloud_operation(request, operation):
    error = None
    result = None
    with transaction.atomic():
        key = request.session.session_key
        Session.objects.select_for_update().filter(session_key=key).first()
        request.session = SessionStore(session_key=key)
        try:
            result = operation()
        except Exception as caught:
            error = caught
        if request.session.modified:
            request.session.save()
            request.session.modified = False
    if error is not None:
        raise error
    return result


class ImportsView(LocalCvView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        rows = CvAsset.objects.filter(user=request.user).order_by('-created_at')
        if request.query_params.get('fileId'):
            rows = rows.filter(file_id=request.query_params['fileId'])
        return Response([{'id': str(row.pk), 'name': row.name, 'fileId': row.file_id} for row in rows[:100]])

    def post(self, request):
        upload, data = upload_input(request)
        extraction = extract_upload(data, upload.name)
        ident = cloud_operation(request, lambda: AssetDrive(request.session, request.user.pk).upload_asset(upload.name, data, extraction['mime']))
        asset = CvAsset.objects.create(user=request.user, drive_id=ident, name=upload.name[:255],
                                       mime=extraction['mime'], size=len(data), extraction=extraction)
        return Response(asset_data(asset), status=201)


class ImportView(CvView):
    def get(self, request, ident):
        return Response(asset_data(get_object_or_404(CvAsset, pk=ident, user=request.user)))

    def patch(self, request, ident):
        asset = get_object_or_404(CvAsset, pk=ident, user=request.user)
        file_id = text_input(request.data, 'fileId', 255)
        self.confirmed_source(request, file_id)
        asset.file_id = file_id
        asset.save(update_fields=['file_id'])
        return Response(asset_data(asset))

    def delete(self, request, ident):
        asset = get_object_or_404(CvAsset, pk=ident, user=request.user)
        AssetDrive(request.session, request.user.pk).delete(asset.drive_id)
        asset.delete()
        return Response(status=204)


class OriginalView(CvView):
    def get(self, request, ident):
        asset = get_object_or_404(CvAsset, pk=ident, user=request.user)
        data = AssetDrive(request.session, request.user.pk).content(asset.drive_id)
        response = HttpResponse(data, content_type=asset.mime)
        response['Content-Disposition'] = content_disposition_header(True, asset.name)
        response['Content-Security-Policy'] = "sandbox; default-src 'none'"
        return response


class JobDescriptionView(LocalCvView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload, data = upload_input(request)
        if Path(upload.name).suffix.lower() not in ('.txt', '.pdf', '.docx'):
            raise CvError('Job descriptions support PDF, DOCX and TXT.')
        result = extract_upload(data, upload.name)
        return Response({'text': result['text'], 'limitations': result['limitations'], 'name': upload.name})


class ReconstructView(LocalCvView):
    def post(self, request):
        text = text_input(request.data, 'text', 100000)
        return Response(text_source(text, text_input(request.data, 'title', 255) or 'Imported CV'))


class AnalyzeView(LocalCvView):
    def post(self, request):
        from .analysis import analyze
        source = source_input(request.data)
        jd = text_input(request.data, 'jobDescription')
        evidence = None
        if request.data.get('assetId'):
            evidence = get_object_or_404(CvAsset, pk=request.data['assetId'], user=request.user).extraction
        try:
            result = analyze(source, jd, evidence, weights=settings.CV_SCORE_WEIGHTS)
        except ValueError:
            raise CvError('The server scoring weights are invalid. Contact the administrator.', 503) from None
        row = AnalysisRun.objects.create(user=request.user, file_id=text_input(request.data, 'fileId', 255),
                                         digest=revision(source), job_description=jd, result=result)
        return Response({'id': str(row.pk), 'digest': row.digest, 'createdAt': row.created_at.isoformat(), 'result': result}, status=201)


class HistoryView(LocalCvView):
    def get(self, request):
        rows = AnalysisRun.objects.filter(user=request.user)
        if request.query_params.get('fileId'):
            rows = rows.filter(file_id=request.query_params['fileId'])
        return Response([{'id': str(row.pk), 'digest': row.digest, 'fileId': row.file_id, 'createdAt': row.created_at.isoformat(), 'result': row.result} for row in rows[:30]])


class RevisionsView(LocalCvView):
    def get(self, request, ident):
        rows = CvRevision.objects.filter(user=request.user, file_id=ident)[:30]
        return Response([{'id': row.pk, 'digest': row.digest, 'createdAt': row.created_at.isoformat(), 'source': row.source} for row in rows])


class ImproveView(LocalCvView):
    def post(self, request):
        from .ai import improve
        source = source_input(request.data)
        suggestions = improve(source, text_input(request.data, 'jobDescription'), text_input(request.data, 'targetRole', 255))
        row = SuggestionRun.objects.create(user=request.user, digest=revision(source), suggestions=suggestions)
        return Response({'id': str(row.pk), 'digest': row.digest, 'suggestions': suggestions}, status=201)
