from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status


class AccountsAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_user_registration(self):
        response = self.client.post("/api/auth/register/", {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "password": "Password123!",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "jane@example.com")
        self.assertEqual(response.data["user"]["name"], "Jane Doe")

    def test_user_login(self):
        user = User.objects.create_user(
            username="testuser@example.com",
            email="testuser@example.com",
            first_name="Test User",
            password="secretpassword"
        )
        response = self.client.post("/api/auth/login/", {
            "email": "testuser@example.com",
            "password": "secretpassword",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
