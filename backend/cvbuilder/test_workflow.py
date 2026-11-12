"""Provider HTTP is doubled only in tests; API, session, storage and renderer are real."""
import json
from email.parser import BytesParser
from email.policy import default
from urllib.parse import urlsplit, parse_qs
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import oauth
from .http import ProviderError


TEST_SETTINGS = dict(GOOGLE_CLIENT_ID="test-client", GOOGLE_CLIENT_SECRET="test-secret",
                     MICROSOFT_CLIENT_ID="test-client", MICROSOFT_CLIENT_SECRET="test-secret",
                     CV_TOKEN_ENCRYPTION_KEY="MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=")


class ProviderTransport:
    def __init__(self):
        self.files = {}
        self.pdfs = []

    def __call__(self, method, url, *, data=None, headers=None, raw=False, with_headers=False):
        parts, query = urlsplit(url), parse_qs(urlsplit(url).query)
        if parts.netloc == "graph.microsoft.com":
            assert method == "PUT" and data.startswith(b"%PDF-")
            self.pdfs.append(("microsoft", data))
            return {"id": "onedrive-pdf"}
        assert parts.netloc == "www.googleapis.com"
        ident = parts.path.rsplit("/", 1)[-1]
        if parts.path.startswith("/upload/"):
            message = BytesParser(policy=default).parsebytes(("Content-Type: " + headers["Content-Type"] + "\r\n\r\n").encode() + data)
            meta, media = list(message.iter_parts())
            metadata = json.loads(meta.get_payload(decode=True))
            content = media.get_payload(decode=True)
            if metadata["mimeType"] == "application/pdf":
                assert content.startswith(b"%PDF-")
                self.pdfs.append(("google", content))
                return {"id": "drive-pdf"}
            ident = "file1" if method == "POST" else ident
            if ident in self.files and headers.get("If-Match") != self.files[ident]["etag"]:
                raise ProviderError(412)
            version = self.files.get(ident, {}).get("version", 0) + 1
            self.files[ident] = {**metadata, "id": ident, "content": content, "version": version, "etag": f'"{version}"'}
            return {"id": ident}
        if method == "GET" and ident == "files":
            return {"files": [{"id": f["id"], "name": f["name"], "modifiedTime": "2026-11-09T00:00:00Z"} for f in self.files.values() if not f.get("trashed")]}
        file = self.files.get(ident)
        if not file or file.get("trashed"):
            raise ProviderError(404)
        if method == "PATCH":
            if headers.get("If-Match") != file["etag"]:
                raise ProviderError(412)
            file["trashed"] = True
            return {}
        if query.get("alt") == ["media"]:
            return file["content"]
        metadata = {key: value for key, value in file.items() if key not in ("content", "etag")}
        return (metadata, {"ETag": file["etag"]}) if with_headers else metadata


@override_settings(**TEST_SETTINGS)
class CompleteWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="workflow")
        self.client = APIClient()
        self.client.force_login(self.user)
        session = self.client.session
        for provider in ("google", "microsoft"):
            oauth.store_tokens(session, provider, {"access_token": "test-access", "refresh_token": "test-refresh", "expires_in": 3600})
        session.save()

    def test_create_list_open_update_download_both_exports_delete(self):
        transport = ProviderTransport()
        with patch("cvbuilder.http.request", side_effect=transport):
            source = {"title": "Workflow", "html": '<div class="row"><div class="col">Engineer</div></div>', "css": ""}
            created = self.client.post("/api/cv/documents/", source, format="json")
            self.assertEqual(created.status_code, 201, created.content)
            saved = created.json()
            self.assertEqual(self.client.get("/api/cv/documents/").json()["files"][0]["id"], saved["fileId"])
            path = "/api/cv/documents/" + saved["fileId"] + "/"
            self.assertEqual(self.client.get(path).json()["source"], source)
            source["html"] += "<p>Updated</p>"
            updated = self.client.put(path, {**source, "confirmation": saved["confirmation"]}, format="json")
            self.assertEqual(updated.status_code, 200, updated.content)
            stale = self.client.put(path, {**source, "confirmation": saved["confirmation"]}, format="json")
            self.assertEqual(stale.status_code, 409)
            proof = {"confirmation": updated.json()["confirmation"]}
            pdf = self.client.post(path + "pdf/", proof, format="json")
            self.assertEqual(pdf.status_code, 200, pdf.content[:100])
            self.assertTrue(pdf.content.startswith(b"%PDF-"))
            for provider in ("google", "microsoft"):
                exported = self.client.post(path + "export/" + provider + "/", proof, format="json")
                self.assertEqual(exported.status_code, 201, exported.content)
            self.assertEqual([p for p, _ in transport.pdfs], ["google", "microsoft"])
            self.assertEqual(self.client.delete(path, proof, format="json").status_code, 204)
            self.assertEqual(self.client.get(path).status_code, 404)
        self.assertNotIn("Engineer", json.dumps(dict(self.client.session)))

    def test_refresh_rotates_encrypted_tokens_and_denied_scope_fails(self):
        session = self.client.session
        oauth.store_tokens(session, "google", {"access_token": "expired", "refresh_token": "old-refresh", "expires_in": -1})
        with patch("cvbuilder.oauth.exchange", return_value={"access_token": "new-access", "refresh_token": "rotated-refresh", "expires_in": 3600}):
            self.assertEqual(oauth.access_token(session, "google"), "new-access")
        self.assertNotIn("new-access", json.dumps(dict(session)))
        self.assertNotIn("rotated-refresh", json.dumps(dict(session)))
        from .errors import CvError
        with self.assertRaises(CvError):
            oauth.store_tokens(session, "google", {"access_token": "denied", "scope": "openid"})

    def test_cross_user_file_id_and_provider_failure(self):
        transport = ProviderTransport()
        with patch("cvbuilder.http.request", side_effect=transport):
            saved = self.client.post("/api/cv/documents/", {"title": "CV", "html": "private", "css": ""}, format="json").json()
            self.client.force_login(User.objects.create_user(username="intruder"))
            session = self.client.session
            oauth.store_tokens(session, "google", {"access_token": "same-drive", "expires_in": 3600})
            session.save()
            self.assertEqual(self.client.get("/api/cv/documents/" + saved["fileId"] + "/").status_code, 404)
        with patch("cvbuilder.http.request", side_effect=ProviderError(429)):
            response = self.client.get("/api/cv/documents/")
            self.assertEqual(response.status_code, 429)
            self.assertNotIn("same-drive", response.content.decode())
