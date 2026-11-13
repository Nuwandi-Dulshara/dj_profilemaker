"""Drive holds editable JSON. Only server-generated PDF bytes reach OneDrive."""
import hashlib
import json
import re
import secrets
from urllib.parse import quote, urlencode, urlsplit

from django.utils.crypto import salted_hmac

from .errors import CvError
from .oauth import authorized_request
from .serializers import SourceSerializer


def source_bytes(source):
    return json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def revision(source):
    return hashlib.sha256(source_bytes(source)).hexdigest()


def filename(title, suffix):
    # Provider filenames have their own limits; the editor/source does not.
    return (re.sub(r'[^\w .-]', '', title, flags=re.UNICODE).strip(" .")[:120] or "CV") + suffix


def file_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise CvError("Invalid Drive file ID.")
    return value


def multipart(metadata, content, mime):
    boundary = "cv_" + secrets.token_hex(16)
    body = (f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n".encode() +
            json.dumps(metadata).encode() + f"\r\n--{boundary}\r\nContent-Type: {mime}\r\n\r\n".encode() +
            content + f"\r\n--{boundary}--\r\n".encode())
    return body, {"Content-Type": f"multipart/related; boundary={boundary}"}


class Drive:
    base = "https://www.googleapis.com/drive/v3/files"
    upload = "https://www.googleapis.com/upload/drive/v3/files"

    def __init__(self, session, user_id):
        self.session = session
        self.owner = salted_hmac("cv-drive-owner", str(user_id)).hexdigest()
        self.etags = {}

    def request(self, method, url, **kwargs):
        return authorized_request(self.session, "google", method, url, **kwargs)

    def metadata(self, ident):
        meta, headers = self.request("GET", self.base + "/" + file_id(ident) + "?fields=id,name,mimeType,appProperties,trashed,version,md5Checksum,modifiedTime,capabilities(canEdit)", with_headers=True)
        props = meta.get("appProperties", {})
        if (meta.get("trashed") or meta.get("mimeType") != "application/json" or props.get("app") != "profile-studio-cv"
                or props.get("owner") != self.owner):
            raise CvError("CV not found in your connected Google Drive.", 404)
        if headers.get("ETag"):
            self.etags[ident] = headers["ETag"]
        return meta

    def list(self, page_token=None):
        params = {"q": "trashed = false and mimeType = 'application/json' and appProperties has { key='app' and value='profile-studio-cv' } and appProperties has { key='owner' and value='" + self.owner + "' }",
                  "fields": "nextPageToken,files(id,name,modifiedTime)", "pageSize": 100, "orderBy": "modifiedTime desc"}
        if page_token:
            params["pageToken"] = page_token
        return self.request("GET", self.base + "?" + urlencode(params))

    def get(self, ident):
        before = self.metadata(ident)
        raw = self.request("GET", self.base + "/" + file_id(ident) + "?alt=media", raw=True)
        after = self.metadata(ident)
        # Drive versions include metadata-only/server changes. Verify the bytes
        # against the latest content checksum instead; source authorization and
        # signed confirmations still use ownership checks and SHA-256.
        checksum = after.get("md5Checksum")
        changed = (hashlib.md5(raw, usedforsecurity=False).hexdigest() != checksum
                   if checksum else before.get("version") != after.get("version"))
        if changed:
            raise CvError("CV changed while retrieving it. Open it again.", 409)
        try:
            source = json.loads(raw)
        except (ValueError, UnicodeError):
            raise CvError("Saved CV source is not a valid CV document.", 422) from None
        serializer = SourceSerializer(data=source)
        if not serializer.is_valid():
            raise CvError("Saved CV source has invalid fields.", 422)
        return dict(serializer.validated_data)

    def save(self, source, ident=None):
        # Updates/deletes are authorized and revision-checked by get() on this instance.
        # A provider ETag, when supplied, also protects against external Drive changes.
        if ident and ident not in self.etags:
            self.metadata(ident)
        meta = {"name": filename(source["title"], ".cv.json"), "mimeType": "application/json",
                "appProperties": {"app": "profile-studio-cv", "owner": self.owner}}
        result = self.upload_file(meta, source_bytes(source), "application/json", ident)
        saved_id = result.get("id")
        if not saved_id:
            raise CvError("Drive did not confirm the save. Refresh your CV list before retrying.", 502)
        saved = self.get(saved_id)
        if saved != source:
            raise CvError("Drive read-back differs from your edit. The save is not confirmed; reopen the file before retrying.", 409)
        return saved_id, saved

    def delete(self, ident):
        if ident not in self.etags:
            self.metadata(ident)
        # Move to Drive trash, so a mistaken deletion is recoverable.
        headers = {"Content-Type": "application/json"}
        if self.etags.get(ident):
            headers["If-Match"] = self.etags[ident]
        self.request("PATCH", self.base + "/" + file_id(ident), data=b'{"trashed":true}', headers=headers)

    def upload_file(self, metadata, content, mime, ident=None):
        url = self.upload + ("/" + file_id(ident) if ident else "")
        method = "PATCH" if ident else "POST"
        headers = {"If-Match": self.etags[ident]} if ident in self.etags else {}
        if len(content) <= 5 * 1024 * 1024:
            data, content_headers = multipart(metadata, content, mime)
            return self.request(method, url + "?uploadType=multipart&fields=id", data=data, headers={**content_headers, **headers})
        _, response_headers = self.request(method, url + "?uploadType=resumable&fields=id", data=json.dumps(metadata).encode(),
            headers={**headers, "Content-Type": "application/json", "X-Upload-Content-Type": mime,
                     "X-Upload-Content-Length": str(len(content))}, with_headers=True)
        location = response_headers.get("Location", "")
        parsed = urlsplit(location)
        if parsed.scheme != "https" or parsed.netloc != "www.googleapis.com" or not parsed.path.startswith("/upload/drive/v3/files"):
            raise CvError("Drive returned an invalid upload session.", 502)
        return self.request("PUT", location, data=content, headers={"Content-Type": mime, "Content-Length": str(len(content))})

    def export_pdf(self, pdf, title):
        result = self.upload_file({"name": filename(title, ".pdf"), "mimeType": "application/pdf"}, pdf, "application/pdf")
        if not result.get("id"):
            raise CvError("Drive did not confirm the PDF upload.", 502)
        return {"fileId": result["id"]}


def export_onedrive(session, pdf, title):
    # Unique names avoid overwriting unrelated OneDrive documents.
    name = filename(title, "-" + secrets.token_hex(4) + ".pdf")
    url = "https://graph.microsoft.com/v1.0/me/drive/root:/" + quote(name, safe="") + ":/content"
    result = authorized_request(session, "microsoft", "PUT", url, data=pdf, headers={"Content-Type": "application/pdf"})
    if not result.get("id"):
        raise CvError("OneDrive did not confirm the PDF upload.", 502)
    return {"fileId": result["id"]}
