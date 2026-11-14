from datetime import timedelta
from unittest.mock import patch
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

User = get_user_model()
PASSWORD = 'Clear-River!Strange-82'


@override_settings(TERMS_URL='https://example.test/terms', PRIVACY_URL='https://example.test/privacy', POLICY_VERSION='test-v1', EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', SECURE_SSL_REDIRECT=False)
class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    def post(self, path, data=None, csrf=True):
        if csrf:
            response = self.client.get('/api/auth/csrf/')
            self.assertEqual(response.status_code, 200)
            self.client.credentials(HTTP_X_CSRFTOKEN=response.json()['csrfToken'])
        return self.client.post('/api/auth/' + path + '/', data or {}, format='json')

    def registration(self, **changes):
        data = {'email': 'alex@example.test', 'first_name': 'Alex', 'last_name': 'Morgan', 'password': PASSWORD, 'confirm_password': PASSWORD, 'accept_policies': True, 'policy_version': 'test-v1'}
        data.update(changes)
        return self.post('register', data)

    def test_register_persists_hashed_password_and_session(self):
        response = self.registration(email='Alex@Example.Test')
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='alex@example.test')
        self.assertTrue(user.check_password(PASSWORD))
        self.assertNotEqual(user.password, PASSWORD)
        self.assertEqual(user.accepted_policy_version, 'test-v1')
        self.assertEqual(self.client.get('/api/auth/me/').json()['user']['id'], user.id)
        self.assertTrue(self.client.cookies[settings.SESSION_COOKIE_NAME]['httponly'])

    def test_registration_validation_and_casefold_duplicate(self):
        self.assertEqual(self.registration(accept_policies=False).status_code, 400)
        self.assertEqual(self.registration(confirm_password='mismatch').status_code, 400)
        self.assertEqual(self.registration(password='123', confirm_password='123').status_code, 400)
        self.assertEqual(self.registration(first_name='').status_code, 400)
        self.assertEqual(self.registration(policy_version='outdated').status_code, 400)
        self.assertEqual(self.registration().status_code, 201)
        self.assertEqual(self.registration(email='ALEX@EXAMPLE.TEST').status_code, 400)
        self.assertEqual(User.objects.count(), 1)

    @override_settings(TERMS_URL='')
    def test_registration_unavailable_without_published_policies(self):
        self.assertEqual(self.registration().status_code, 503)
        self.assertFalse(User.objects.exists())

    def test_anonymous_mutations_require_csrf(self):
        for endpoint in ['register', 'login', 'logout', 'password-reset', 'password-reset/confirm']:
            self.assertEqual(self.post(endpoint, csrf=False).status_code, 403)

    def test_login_generic_failure_logout_and_remember_policy(self):
        User.objects.create_user('alex@example.test', PASSWORD)
        missing = self.post('login', {'email': 'missing@example.test', 'password': 'wrong'}).json()
        wrong = self.post('login', {'email': 'alex@example.test', 'password': 'wrong'}).json()
        self.assertEqual(missing, wrong)
        result = self.post('login', {'email': 'ALEX@example.test', 'password': PASSWORD, 'remember_me': False})
        self.assertEqual(result.status_code, 200)
        self.assertTrue(self.client.session.get_expire_at_browser_close())
        old_session = self.client.cookies[settings.SESSION_COOKIE_NAME].value
        self.assertEqual(self.post('logout').status_code, 200)
        from django.contrib.sessions.models import Session
        self.assertFalse(Session.objects.filter(session_key=old_session).exists())
        self.assertIsNone(self.client.get('/api/auth/me/').json()['user'])

    def test_reset_is_generic_and_token_single_use(self):
        user = User.objects.create_user('alex@example.test', PASSWORD)
        existing = self.post('password-reset', {'email': user.email})
        absent = self.post('password-reset', {'email': 'missing@example.test'})
        self.assertEqual(existing.json(), absent.json())
        self.assertEqual(len(mail.outbox), 1)
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        self.assertIn(f'/reset-password/{uid}/', mail.outbox[0].body)
        data = {'uid': uid, 'token': token, 'password': 'Different-Phrase!82', 'confirm_password': 'Different-Phrase!82'}
        self.assertEqual(self.post('password-reset/confirm', data).status_code, 200)
        self.assertEqual(self.post('password-reset/confirm', data).status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password('Different-Phrase!82'))

    def test_reset_expired_token_rejected(self):
        user = User.objects.create_user('alex@example.test', PASSWORD)
        with patch.object(default_token_generator, '_now', return_value=default_token_generator._now() - timedelta(hours=2)):
            token = default_token_generator.make_token(user)
        data = {'uid': urlsafe_base64_encode(force_bytes(user.pk)), 'token': token, 'password': PASSWORD, 'confirm_password': PASSWORD}
        self.assertEqual(self.post('password-reset/confirm', data).status_code, 400)

    def test_login_rate_limit(self):
        for _ in range(10):
            self.assertEqual(self.post('login', {'email': 'nobody@example.test', 'password': 'wrong'}).status_code, 400)
        self.assertEqual(self.post('login', {'email': 'nobody@example.test', 'password': 'wrong'}).status_code, 429)

    def test_email_delivery_failure_does_not_reveal_account_existence(self):
        User.objects.create_user('alex@example.test', PASSWORD)
        with patch('accounts.views.send_mail', side_effect=OSError('mail server unavailable')):
            existing = self.post('password-reset', {'email': 'alex@example.test'})
            absent = self.post('password-reset', {'email': 'missing@example.test'})
        self.assertEqual(existing.status_code, absent.status_code)
        self.assertEqual(existing.json(), absent.json())
