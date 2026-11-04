from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from profiles.models import Profile, Skill, SocialLink


class ProfilesApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="dev@example.com",
            email="dev@example.com",
            first_name="Dev Tester",
            password="testpassword123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_create_and_get_profile(self):
        payload = {
            "name": "Sarah Connor",
            "title": "Security Lead",
            "bio": "Protecting systems.",
            "email": "sarah@example.com",
            "phone": "+1 555 0199",
            "location": "Los Angeles, CA",
            "template_id": "modern",
            "skills": [
                {"name": "Cybersecurity", "level": 95},
                {"name": "Python", "level": 80},
            ],
            "links": [
                {"platform": "GitHub", "url": "https://github.com/sarah"},
            ]
        }
        create_res = self.client.post("/api/profiles/", payload, format="json")
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        profile_id = create_res.data["id"]
        slug = create_res.data["slug"]
        self.assertEqual(create_res.data["template_id"], "modern")
        self.assertEqual(len(create_res.data["skills"]), 2)

        # Public profile access without auth
        anon_client = APIClient()
        public_res = anon_client.get(f"/api/public/p/{slug}/")
        self.assertEqual(public_res.status_code, status.HTTP_200_OK)
        self.assertEqual(public_res.data["profile"]["name"], "Sarah Connor")

        # Dashboard stats
        stats_res = self.client.get("/api/profiles/dashboard/stats/")
        self.assertEqual(stats_res.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_res.data["stats"]["total_profiles"], 1)
        self.assertEqual(stats_res.data["stats"]["total_skills"], 2)
