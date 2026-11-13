"""Authorization code + PKCE; encrypted tokens live only in DB-backed sessions."""
import base64
import hashlib
import json
import re
import secrets
import time
from urllib.parse import urlencode

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone

from . import http
from .errors import CvError


def config(provider):
    if provider == "google":
        prefix = "GOOGLE"
        authorize = "https://accounts.google.com/o/oauth2/v2/auth"
        token = "https://oauth2.googleapis.com/token"
        scope = "https://www.googleapis.com/auth/drive.file"
    elif provider == "microsoft":
        prefix = "MICROSOFT"
        tenant = settings.MICROSOFT_TENANT
        if not re.fullmatch(r"[a-zA-Z0-9.-]+", tenant):
            raise CvError("Microsoft tenant configuration is invalid.", 503)
        base = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0"
        authorize, token = base + "/authorize", base + "/token"
        scope = "offline_access Files.ReadWrite"
    else:
        raise CvError("Unknown cloud provider.", 404)
    return {"client_id": getattr(settings, prefix + "_CLIENT_ID"), "client_secret": getattr(settings, prefix + "_CLIENT_SECRET"),
            "redirect_uri": getattr(settings, prefix + "_REDIRECT_URI"), "authorize": authorize, "token": token, "scope": scope}


def cipher():
    try:
        return Fernet(settings.CV_TOKEN_ENCRYPTION_KEY.encode("ascii"))
    except (ValueError, UnicodeError):
        raise CvError("Configure CV_TOKEN_ENCRYPTION_KEY on the server before connecting cloud accounts.", 503) from None


def configured(provider):
    c = config(provider)
    try:
        cipher()
    except CvError:
        return False
    return bool(c["client_id"] and c["client_secret"] and c["redirect_uri"])


def require_config(provider):
    if not configured(provider):
        raise CvError(f"{provider.title()} OAuth is not configured on the server. See backend/.env.example.", 503)
    return config(provider)


def start(session, user_id, provider):
    c = require_config(provider)
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
    session["cv_oauth_" + provider] = {"state": state, "verifier": verifier, "user": user_id, "created": time.time()}
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    params = {"client_id": c["client_id"], "redirect_uri": c["redirect_uri"], "response_type": "code", "scope": c["scope"],
              "state": state, "code_challenge": challenge, "code_challenge_method": "S256"}
    if provider == "google":
        params.update(access_type="offline", prompt="consent")
    else:
        params.update(response_mode="query", prompt="select_account")
    return c["authorize"] + "?" + urlencode(params)


def consume_state(session, user_id, provider, state):
    # DB row lock makes state consumption single-use even for simultaneous callbacks.
    with transaction.atomic():
        row = Session.objects.select_for_update().filter(session_key=session.session_key, expire_date__gt=timezone.now()).first()
        values = row.get_decoded() if row else {}
        pending = values.get("cv_oauth_" + provider, {})
        if not (pending and isinstance(state, str) and secrets.compare_digest(pending.get("state", ""), state)
                and pending.get("user") == user_id and time.time() - pending.get("created", 0) < 600):
            raise CvError("Authorization expired or does not belong to this session. Connect again.")
        values.pop("cv_oauth_" + provider)
        row.session_data = session.encode(values)
        row.save(update_fields=["session_data"])
        session.pop("cv_oauth_" + provider, None)
    return pending["verifier"]


def exchange(provider, fields):
    c = require_config(provider)
    fields = {**fields, "client_id": c["client_id"], "client_secret": c["client_secret"]}
    return http.request("POST", c["token"], data=urlencode(fields).encode(), headers={"Content-Type": "application/x-www-form-urlencoded"})


def store_tokens(session, provider, tokens, previous=None):
    if not isinstance(tokens, dict) or not tokens.get("access_token"):
        raise CvError("Authorization did not return an access token. Connect again.", 502)
    requested = set(config(provider)["scope"].split()) - {"offline_access"}
    if "scope" in tokens and not requested.issubset(set(tokens["scope"].split())):
        raise CvError("The required file permissions were not granted. Connect again and allow file access.", 409)
    try:
        expiry = time.time() + int(tokens.get("expires_in", 3600))
    except (TypeError, ValueError):
        raise CvError("Provider returned an invalid token lifetime.", 502) from None
    value = {"access_token": tokens["access_token"], "refresh_token": tokens.get("refresh_token") or (previous or {}).get("refresh_token"), "expires_at": expiry}
    session["cv_" + provider] = cipher().encrypt(json.dumps(value).encode()).decode()


def complete(session, user_id, provider, query):
    verifier = consume_state(session, user_id, provider, query.get("state", ""))
    if query.get("error") or not query.get("code"):
        raise CvError("Cloud authorization was cancelled or denied. Your CV edits are unchanged.")
    tokens = exchange(provider, {"grant_type": "authorization_code", "code": query["code"],
                                "redirect_uri": config(provider)["redirect_uri"], "code_verifier": verifier})
    store_tokens(session, provider, tokens)


def access_token(session, provider, force_refresh=False):
    require_config(provider)
    try:
        value = json.loads(cipher().decrypt(session.get("cv_" + provider, "").encode()))
    except (InvalidToken, ValueError, TypeError):
        raise CvError(f"Connect {provider.title()} before using this action.", 409) from None
    if force_refresh or value["expires_at"] <= time.time() + 60:
        if not value.get("refresh_token"):
            raise CvError(f"Reconnect {provider.title()}; the connection has expired.", 409)
        try:
            new = exchange(provider, {"grant_type": "refresh_token", "refresh_token": value["refresh_token"]})
        except http.ProviderError as error:
            if error.provider_status in (400, 401, 403):
                session.pop("cv_" + provider, None)
                raise CvError(f"Reconnect {provider.title()}; cloud authorization was revoked or expired.", 409) from None
            raise
        store_tokens(session, provider, new, value)
        return new["access_token"]
    return value["access_token"]


def authorized_request(session, provider, method, url, **kwargs):
    headers = dict(kwargs.pop("headers", {}))
    headers["Authorization"] = "Bearer " + access_token(session, provider)
    try:
        return http.request(method, url, headers=headers, **kwargs)
    except http.ProviderError as error:
        if error.provider_status != 401:
            raise
        headers["Authorization"] = "Bearer " + access_token(session, provider, force_refresh=True)
        return http.request(method, url, headers=headers, **kwargs)
