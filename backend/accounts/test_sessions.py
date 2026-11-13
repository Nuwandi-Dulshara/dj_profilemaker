from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class BrowserSessionTests(TestCase):
    def setUp(self):
        User.objects.create_user(username="session@example.com", email="session@example.com", password="secret123")
        self.client = APIClient(enforce_csrf_checks=True)

    def test_login_requires_csrf_and_sets_http_only_session(self):
        payload = {"email": "session@example.com", "password": "secret123"}
        response = self.client.post("/api/auth/session/login/", payload, format="json")
        self.assertEqual(response.status_code, 403)
        csrf = self.client.get("/api/auth/csrf/").json()["csrfToken"]
        response = self.client.post("/api/auth/session/login/", payload, format="json", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("token", response.json())
        self.assertTrue(response.cookies["sessionid"]["httponly"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 403)
        csrf = self.client.get("/api/auth/csrf/").json()["csrfToken"]
        self.assertEqual(self.client.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=csrf).status_code, 200)
        self.assertIn(self.client.get("/api/auth/me/").status_code, (401, 403))

    def test_cv_requires_login(self):
        self.assertIn(self.client.get("/api/cv/documents/").status_code, (401, 403))

    def test_changing_password_retains_current_browser_session(self):
        self.client.login(username="session@example.com", password="secret123")
        csrf = self.client.get("/api/auth/csrf/").json()["csrfToken"]
        response = self.client.put("/api/auth/settings/", {"current_password": "secret123", "new_password": "newsecret123"}, format="json", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    def test_cv_unsafe_requests_require_csrf(self):
        self.client.login(username="session@example.com", password="secret123")
        response = self.client.post("/api/cv/documents/", {"title": "CV", "html": "test"}, format="json")
        self.assertEqual(response.status_code, 403)
