import io
import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, SimpleTestCase, override_settings
from rest_framework.test import APIClient


SOURCE = {"title": "Engineer", "html": "<h1>Saved CV</h1>", "css": ""}


class CvApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="cv", password="password123")
        self.client = APIClient()
        self.client.force_login(self.user)

    @override_settings(GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="", MICROSOFT_CLIENT_ID="", MICROSOFT_CLIENT_SECRET="")
    def test_status_reports_unconfigured_providers_without_secrets(self):
        response = self.client.get("/api/cv/status/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["google"]["configured"])
        self.assertNotIn("secret", json.dumps(response.json()))

    def test_save_returns_readback_not_submitted_source(self):
        with patch("cvbuilder.views.Drive") as drive:
            drive.return_value.save.return_value = ("file123", SOURCE)
            response = self.client.post("/api/cv/documents/", SOURCE, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["source"], SOURCE)
        self.assertTrue(response.json()["confirmation"])
        self.assertIn("Saved CV", response.json()["previewHtml"])
        self.assertNotIn("Saved CV", json.dumps(dict(self.client.session)))

    def test_rejects_blank_and_non_string_source(self):
        for html in (" ", {}, 42, None):
            response = self.client.post("/api/cv/documents/", {**SOURCE, "html": html}, format="json")
            self.assertEqual(response.status_code, 400)

    def test_large_json_source_is_not_limited_by_django_form_upload_limit(self):
        source = {**SOURCE, "html": "<p>" + "x" * (6 * 1024 * 1024) + "</p>"}
        with patch("cvbuilder.views.Drive") as drive:
            drive.return_value.save.return_value = ("large", source)
            response = self.client.post("/api/cv/documents/", source, format="json")
        self.assertEqual(response.status_code, 201, response.content[:2000])
        self.assertEqual(response.json()["source"]["html"], source["html"])

    def test_pdf_requires_confirmation(self):
        response = self.client.post("/api/cv/documents/file123/pdf/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_stale_or_other_user_confirmation_cannot_render(self):
        from .views import confirmed_document
        confirmation = confirmed_document(self.user, "file123", SOURCE)["confirmation"]
        with patch("cvbuilder.views.Drive") as drive:
            drive.return_value.get.return_value = {**SOURCE, "html": "changed"}
            response = self.client.post("/api/cv/documents/file123/pdf/", {"confirmation": confirmation}, format="json")
        self.assertEqual(response.status_code, 409)
        other = User.objects.create_user(username="other")
        self.client.force_login(other)
        response = self.client.post("/api/cv/documents/file123/pdf/", {"confirmation": confirmation}, format="json")
        self.assertEqual(response.status_code, 409)

    def test_real_pdf_endpoint_download(self):
        from .views import confirmed_document
        confirmation = confirmed_document(self.user, "file123", SOURCE)["confirmation"]
        with patch("cvbuilder.views.Drive") as drive:
            drive.return_value.get.return_value = SOURCE
            response = self.client.post("/api/cv/documents/file123/pdf/", {"confirmation": confirmation}, format="json")
        self.assertEqual(response.status_code, 200, response.content[:200])
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "no-store")


class RenderingTests(SimpleTestCase):
    def test_full_document_does_not_receive_fragment_page_padding(self):
        from .rendering import build_preview
        import html5lib
        full = html5lib.parse(build_preview({**SOURCE, "html": '<!doctype html><html><body><main style="padding:15mm">CV</main></body></html>'}), namespaceHTMLElements=False)
        fragment = html5lib.parse(build_preview(SOURCE), namespaceHTMLElements=False)
        self.assertNotIn("data-cv-fragment", full.find("body").attrib)
        self.assertEqual(fragment.find("body").get("data-cv-fragment"), "true")

    def test_removes_active_content_and_preserves_long_full_document(self):
        from .rendering import build_preview
        import html5lib
        html = '<html lang="fr"><head><style>.row{color:navy}</style></head><body class="container"><script>bad()</script><iframe src="http://localhost"></iframe><img src="file:///etc/passwd" onerror="bad()"><a href="javascript:bad()">Link</a><p>' + 'CV ' * 100000 + '</p></body></html>'
        rendered = build_preview({**SOURCE, "html": html})
        doc = html5lib.parse(rendered, namespaceHTMLElements=False)
        self.assertIsNone(doc.find(".//script"))
        self.assertIsNone(doc.find(".//iframe"))
        self.assertNotIn("src", doc.find(".//img").attrib)
        self.assertNotIn("href", doc.find(".//a").attrib)
        self.assertEqual(doc.find(".//p").text, 'CV ' * 100000)
        self.assertEqual(doc.attrib["lang"], "fr")
        self.assertIn("default-src 'none'", rendered)
        self.assertIn("Bootstrap", rendered)

    def test_real_pdf_is_multipage_a4_and_preserves_text(self):
        from .rendering import render_pdf
        from pypdf import PdfReader
        source = {**SOURCE, "html": '<h1>First page</h1><div style="break-before:page"><h1>Second page</h1></div>'}
        pdf = PdfReader(io.BytesIO(render_pdf(source)))
        self.assertEqual(len(pdf.pages), 2)
        for page in pdf.pages:
            self.assertAlmostEqual(float(page.mediabox.width), 595.28, delta=1)
            self.assertAlmostEqual(float(page.mediabox.height), 841.89, delta=1)
        self.assertIn("Second page", pdf.pages[1].extract_text())

    def test_author_page_selectors_cannot_change_a4_export_size(self):
        from .rendering import render_pdf
        from pypdf import PdfReader
        source = {**SOURCE, "html": '<style>@page :first { size: A3 !important; } @page wide { size: letter landscape !important; } .wide { page: wide; break-before: page; }</style><h1>First</h1><section class="wide">Second</section>'}
        pdf = PdfReader(io.BytesIO(render_pdf(source)))
        for page in pdf.pages:
            self.assertAlmostEqual(float(page.mediabox.width), 595.28, delta=1)
            self.assertAlmostEqual(float(page.mediabox.height), 841.89, delta=1)


class DriveTests(SimpleTestCase):
    def test_metadata_only_version_change_does_not_reject_saved_content(self):
        import hashlib
        from .cloud import Drive, source_bytes
        drive = Drive({}, 10)
        raw = source_bytes(SOURCE)
        checksum = hashlib.md5(raw, usedforsecurity=False).hexdigest()
        with patch.object(drive, "metadata", side_effect=[{"version": "1", "md5Checksum": checksum}, {"version": "2", "md5Checksum": checksum}]), patch.object(drive, "request", return_value=raw):
            self.assertEqual(drive.get("file123"), SOURCE)

    def test_content_changed_during_download_is_rejected(self):
        from .cloud import Drive, source_bytes
        from .errors import CvError
        drive = Drive({}, 10)
        with patch.object(drive, "metadata", return_value={"version": "1", "md5Checksum": "0" * 32}), patch.object(drive, "request", return_value=source_bytes(SOURCE)):
            with self.assertRaises(CvError) as error:
                drive.get("file123")
        self.assertEqual(error.exception.status_code, 409)

    def test_missing_checksum_keeps_version_conflict_protection(self):
        from .cloud import Drive, source_bytes
        from .errors import CvError
        drive = Drive({}, 10)
        with patch.object(drive, "metadata", side_effect=[{"version": "1"}, {"version": "2"}]), patch.object(drive, "request", return_value=source_bytes(SOURCE)):
            with self.assertRaises(CvError):
                drive.get("file123")

    def test_update_uses_retrieved_etag_to_prevent_lost_update(self):
        from .cloud import Drive
        drive = Drive({}, 10)
        drive.etags["file123"] = '"version-one"'
        with patch.object(drive, "request", return_value={"id": "file123"}) as request, patch.object(drive, "get", return_value=SOURCE):
            drive.save(SOURCE, "file123")
        self.assertEqual(request.call_args.kwargs["headers"]["If-Match"], '"version-one"')

    def test_large_source_uses_resumable_upload(self):
        from .cloud import Drive
        drive = Drive({}, 10)
        source = {**SOURCE, "html": "x" * (6 * 1024 * 1024)}
        location = "https://www.googleapis.com/upload/drive/v3/files?upload_id=abc"
        with patch.object(drive, "request", side_effect=[({}, {"Location": location}), {"id": "file123"}]) as request, patch.object(drive, "get", return_value=source):
            ident, saved = drive.save(source)
        self.assertEqual(ident, "file123")
        self.assertEqual(saved, source)
        self.assertIn("uploadType=resumable", request.call_args_list[0].args[1])
        self.assertEqual(request.call_args_list[1].args, ("PUT", location))

    def test_wrong_owner_rejected_before_content_access(self):
        from .cloud import Drive
        from .errors import CvError
        drive = Drive({}, 10)
        with patch.object(drive, "request", return_value=({"appProperties": {"owner": "other"}, "mimeType": "application/json"}, {})):
            with self.assertRaises(CvError) as error:
                drive.get("file123")
        self.assertEqual(error.exception.status_code, 404)

    def test_save_checks_readback_matches_exact_source(self):
        from .cloud import Drive
        from .errors import CvError
        drive = Drive({}, 10)
        with patch.object(drive, "request", return_value={"id": "file123"}), patch.object(drive, "get", return_value={**SOURCE, "html": "different"}):
            with self.assertRaises(CvError) as error:
                drive.save(SOURCE)
        self.assertEqual(error.exception.status_code, 409)


@override_settings(GOOGLE_CLIENT_ID="client", GOOGLE_CLIENT_SECRET="secret", CV_TOKEN_ENCRYPTION_KEY="MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=")
class OAuthTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="oauth")
        self.client = APIClient()
        self.client.force_login(self.user)

    def test_state_is_session_bound_and_single_use(self):
        from urllib.parse import urlparse, parse_qs
        response = self.client.post("/api/cv/oauth/google/start/")
        self.assertEqual(response.status_code, 200)
        query = parse_qs(urlparse(response.json()["url"]).query)
        self.assertEqual(query["code_challenge_method"], ["S256"])
        callback = "/api/cv/oauth/google/callback/?code=code&state=" + query["state"][0]
        with patch("cvbuilder.oauth.exchange", return_value={"access_token": "private-access", "refresh_token": "private-refresh", "expires_in": 3600}):
            first = self.client.get(callback)
            second = self.client.get(callback)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)
        data = json.dumps(dict(self.client.session))
        self.assertNotIn("private-access", data)
        self.assertNotIn("private-refresh", data)
        self.assertNotIn("private-access", first.content.decode())

    def test_unknown_state_does_not_connect(self):
        response = self.client.get("/api/cv/oauth/google/callback/?code=x&state=wrong")
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("cv_google", self.client.session)
