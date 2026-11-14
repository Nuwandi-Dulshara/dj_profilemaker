"""Create/migrate only the dedicated browser-test database, never the normal app database."""
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.e2e_settings'
import django
django.setup()
from django.conf import settings
from django.core.management import call_command
import psycopg

db = settings.DATABASES['default']
assert db['NAME'] == 'cv_studio_e2e'
with psycopg.connect(dbname='postgres', user=db['USER'], password=db['PASSWORD'], host=db['HOST'], port=db['PORT'], autocommit=True) as connection:
    if not connection.execute('SELECT 1 FROM pg_database WHERE datname = %s', ('cv_studio_e2e',)).fetchone():
        connection.execute('CREATE DATABASE cv_studio_e2e')
call_command('migrate', verbosity=0)
from accounts.models import AuthRateBucket
AuthRateBucket.objects.all().delete()
print('Isolated browser-test database ready.')
