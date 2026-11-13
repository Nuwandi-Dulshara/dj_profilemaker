"""Small HTTPS transport. Never include provider bodies/tokens in user errors."""
import json
import socket
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

from .errors import CvError


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ProviderError(CvError):
    def __init__(self, status):
        self.provider_status = status
        message = "Cloud provider request failed. Please retry."
        local_status = 502
        if status in (401, 403):
            message = "Cloud access expired or permission was denied. Reconnect the provider and grant the requested permissions."
            local_status = 409
        elif status == 404:
            message, local_status = "The cloud file was not found or is no longer accessible.", 404
        elif status in (409, 412):
            message, local_status = "The cloud file changed. Open the saved version before retrying.", 409
        elif status == 429:
            message, local_status = "The cloud provider is busy. Please wait and retry.", 429
        super().__init__(message, local_status, "provider_error")


def request(method, url, *, data=None, headers=None, raw=False, with_headers=False):
    req = Request(url, data=data, headers=headers or {}, method=method)
    try:
        with build_opener(NoRedirect()).open(req, timeout=30) as response:
            body = response.read()
            response_headers = response.headers
        result = body if raw else json.loads(body) if body else {}
        return (result, response_headers) if with_headers else result
    except HTTPError as error:
        raise ProviderError(error.code) from None
    except (URLError, TimeoutError, socket.timeout, OSError) as error:
        reason = error.reason if isinstance(error, URLError) else error
        if isinstance(reason, PermissionError) or getattr(reason, "winerror", None) == 10013:
            message = "The server's cloud connection is blocked by its runtime or network policy. Restart the backend in a normal terminal with internet access, then connect again. Your CV edits are unchanged."
        else:
            message = "The server could not reach the cloud provider. Check the server's internet connection and retry. Your CV edits are unchanged."
        raise CvError(message, 503) from None
    except (ValueError, UnicodeError):
        raise CvError("The cloud provider returned an invalid response. Please retry.", 502) from None
