import hashlib
import html
import json
from urllib.parse import urlsplit

from django.conf import settings
from django.core import signing
from django.http import HttpResponse
from django.contrib.auth.models import User
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone
from django.utils.http import content_disposition_header
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from . import oauth
from .cloud import Drive, export_onedrive, filename, revision
from .errors import CvError
from .rendering import build_preview, render_pdf
from .serializers import SourceSerializer, ConfirmationSerializer
from .parsers import CvSourceJSONParser


def confirmed_document(user, ident, source):
    digest = revision(source)
    proof = signing.dumps({"user": user.pk, "file": ident, "revision": digest}, salt="cv-confirmation")
    return {"fileId": ident, "source": source, "revision": digest, "confirmation": proof, "previewHtml": build_preview(source)}


class CvThrottle(UserRateThrottle):
    rate = "120/min"
    scope = "cv"


class CvView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [CvThrottle]

    def dispatch(self, request, *args, **kwargs):
        # Serialize session updates across workers/tabs, including refresh-token rotation
        # and single-use OAuth state. Persist under the lock, not later in middleware.
        with transaction.atomic():
            key = request.session.session_key
            if key:
                Session.objects.select_for_update().filter(session_key=key, expire_date__gt=timezone.now()).first()
                request.session = SessionStore(session_key=key)
            response = super().dispatch(request, *args, **kwargs)
            if request.session.modified and request.session.session_key:
                request.session.save()
                request.session.modified = False
            return response

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def drive(self, request):
        if not hasattr(self, "_drive"):
            self._drive = Drive(request.session, request.user.pk)
        return self._drive

    def confirmed_source(self, request, ident):
        serializer = ConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            proof = signing.loads(serializer.validated_data["confirmation"], salt="cv-confirmation", max_age=86400)
        except signing.BadSignature:
            raise CvError("Saved confirmation expired. Open the saved CV again.", 409) from None
        if proof.get("user") != request.user.pk or proof.get("file") != ident:
            raise CvError("This saved confirmation does not belong to your CV.", 409)
        source = self.drive(request).get(ident)
        if proof.get("revision") != revision(source):
            raise CvError("The saved CV changed in Drive. Open it again before continuing.", 409)
        return source


class StatusView(CvView):
    def get(self, request):
        return Response({p: {"configured": oauth.configured(p), "connected": bool(request.session.get("cv_" + p))} for p in ("google", "microsoft")})


class OAuthStartView(CvView):
    def post(self, request, provider):
        return Response({"url": oauth.start(request.session, request.user.pk, provider)})


class OAuthDisconnectView(CvView):
    def post(self, request, provider):
        oauth.config(provider)
        request.session.pop("cv_" + provider, None)
        request.session.pop("cv_oauth_" + provider, None)
        return Response(status=204)


class OAuthCallbackView(CvView):
    def get(self, request, provider):
        oauth.config(provider)
        success, message, status = True, "Cloud account connected. You may close this window.", 200
        try:
            oauth.complete(request.session, request.user.pk, provider, request.query_params)
        except CvError as error:
            success, message, status = False, str(error.detail), error.status_code
        origin_parts = urlsplit(settings.FRONTEND_URL)
        origin = f"{origin_parts.scheme}://{origin_parts.netloc}"
        payload = json.dumps({"type": "cv-oauth", "provider": provider, "success": success, "message": message}).replace("<", "\\u003c")
        script = f"if(window.opener){{window.opener.postMessage({payload},{json.dumps(origin)});window.close();}}"
        digest = __import__("base64").b64encode(hashlib.sha256(script.encode()).digest()).decode()
        response = HttpResponse(f"<!doctype html><meta charset='utf-8'><title>CV cloud connection</title><p>{html.escape(message)}</p><script>{script}</script>", status=status)
        response["Content-Security-Policy"] = f"default-src 'none'; script-src 'sha256-{digest}'; base-uri 'none'; frame-ancestors 'none'"
        response["Referrer-Policy"] = "no-referrer"
        response["Cross-Origin-Opener-Policy"] = "unsafe-none"
        return response


class DocumentsView(CvView):
    parser_classes = [CvSourceJSONParser]

    def get(self, request):
        return Response(self.drive(request).list(request.query_params.get("pageToken")))

    def post(self, request):
        serializer = SourceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ident, source = self.drive(request).save(dict(serializer.validated_data))
        return Response(confirmed_document(request.user, ident, source), status=201)


class DocumentView(CvView):
    parser_classes = [CvSourceJSONParser]

    def get(self, request, ident):
        return Response(confirmed_document(request.user, ident, self.drive(request).get(ident)))

    def put(self, request, ident):
        # Existing user row is the cross-session lock; no schema/source storage added.
        User.objects.select_for_update().get(pk=request.user.pk)
        self.confirmed_source(request, ident)
        serializer = SourceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ident, source = self.drive(request).save(dict(serializer.validated_data), ident)
        return Response(confirmed_document(request.user, ident, source))

    def delete(self, request, ident):
        User.objects.select_for_update().get(pk=request.user.pk)
        self.confirmed_source(request, ident)
        self.drive(request).delete(ident)
        return Response(status=204)


class PdfView(CvView):
    def post(self, request, ident):
        source = self.confirmed_source(request, ident)
        response = HttpResponse(render_pdf(source), content_type="application/pdf")
        response["Content-Disposition"] = content_disposition_header(True, filename(source["title"], ".pdf"))
        return response


class ExportView(CvView):
    def post(self, request, ident, provider):
        oauth.require_config(provider)
        # Verify target connection before expensive rendering.
        oauth.access_token(request.session, provider)
        source = self.confirmed_source(request, ident)
        pdf = render_pdf(source)
        result = self.drive(request).export_pdf(pdf, source["title"]) if provider == "google" else export_onedrive(request.session, pdf, source["title"])
        return Response(result, status=201)
