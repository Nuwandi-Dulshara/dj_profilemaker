"""Isolated browser-test configuration. Never use for an actual deployment."""
from .settings import *  # noqa: F403

DEBUG = True
DATABASES['default']['NAME'] = 'cv_studio_e2e'
DATABASES['default']['CONN_MAX_AGE'] = 0
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
CSRF_TRUSTED_ORIGINS = ['http://127.0.0.1:5173']
FRONTEND_URL = 'http://127.0.0.1:5173'
TERMS_URL = 'https://example.test/test-only-terms'
PRIVACY_URL = 'https://example.test/test-only-privacy'
POLICY_VERSION = 'automated-test-only'
EMAIL_BACKEND = 'django.core.mail.backends.filebased.EmailBackend'
EMAIL_FILE_PATH = BASE_DIR.parent / '.local-postgres' / 'test-email'
