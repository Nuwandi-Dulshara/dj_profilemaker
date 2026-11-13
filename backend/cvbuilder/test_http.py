from unittest.mock import patch
from urllib.error import URLError

from django.test import SimpleTestCase
from .http import request
from .errors import CvError


class NetworkFailureTests(SimpleTestCase):
    def test_blocked_network_explains_server_problem_without_exposing_secrets(self):
        error = PermissionError(13, "secret-token-in-low-level-message")
        with patch("cvbuilder.http.build_opener") as opener:
            opener.return_value.open.side_effect = URLError(error)
            with self.assertRaises(CvError) as raised:
                request("GET", "https://www.googleapis.com/drive/v3/files")
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("server", str(raised.exception.detail).lower())
        self.assertIn("blocked", str(raised.exception.detail).lower())
        self.assertNotIn("secret-token", str(raised.exception.detail))
