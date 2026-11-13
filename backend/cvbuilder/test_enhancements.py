from unittest.mock import patch
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


class EnhancementTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='enhanced')
        self.client = APIClient()
        self.client.force_login(self.user)

    def test_import_persists_original_and_denies_other_user(self):
        with patch('cvbuilder.assets.AssetDrive.upload_asset', return_value='asset-file'):
            response = self.client.post('/api/cv/imports/', {'file': SimpleUploadedFile('cv.html', b'<h1>Jane</h1>')})
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['source']['html'], '<h1>Jane</h1>')
        self.assertEqual(self.client.get('/api/cv/imports/' + data['id'] + '/').status_code, 200)
        self.client.force_login(User.objects.create_user(username='stranger'))
        self.assertEqual(self.client.get('/api/cv/imports/' + data['id'] + '/').status_code, 404)

    def test_failed_upload_creates_no_asset(self):
        from .models import CvAsset
        from .errors import CvError
        with patch('cvbuilder.assets.AssetDrive.upload_asset', side_effect=CvError('Unavailable', 503)):
            response = self.client.post('/api/cv/imports/', {'file': SimpleUploadedFile('cv.html', b'<h1>Jane</h1>')})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(CvAsset.objects.count(), 0)

    def test_failed_cloud_delete_retains_original_metadata(self):
        from .models import CvAsset
        from .errors import CvError
        asset = CvAsset.objects.create(user=self.user, drive_id='original', name='cv.png', mime='image/png', size=10)
        with patch('cvbuilder.assets.AssetDrive.delete', side_effect=CvError('Unavailable', 503)):
            response = self.client.delete(f'/api/cv/imports/{asset.pk}/')
        self.assertEqual(response.status_code, 503)
        self.assertTrue(CvAsset.objects.filter(pk=asset.pk).exists())

    def test_original_download_is_private_and_script_is_sandboxed(self):
        from .models import CvAsset
        asset = CvAsset.objects.create(user=self.user, drive_id='original', name='cv.html', mime='text/html', size=10)
        with patch('cvbuilder.assets.AssetDrive.content', return_value=b'<script>bad()</script>'):
            response = self.client.get(f'/api/cv/imports/{asset.pk}/original/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn('sandbox', response['Content-Security-Policy'])
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.client.force_login(User.objects.create_user(username='download-stranger'))
        self.assertEqual(self.client.get(f'/api/cv/imports/{asset.pk}/original/').status_code, 404)

    def test_job_upload_extracts_text_without_persisting(self):
        response = self.client.post('/api/cv/job-description/', {'file': SimpleUploadedFile('job.txt', b'Required: Python and SQL')})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['text'], 'Required: Python and SQL')

    @override_settings(CV_AI_URL='', CV_AI_KEY='', CV_AI_MODEL='')
    def test_unconfigured_ai_fails_without_fake_suggestions(self):
        response = self.client.post('/api/cv/improve/', {'source': {'title': 'CV', 'html': '<p>Built APIs</p>', 'css': ''}}, format='json')
        self.assertEqual(response.status_code, 503, response.content)

    def test_analysis_history_is_owned_and_no_job_score_without_jd(self):
        response = self.client.post('/api/cv/analyze/', {'source': {'title': 'CV', 'html': '<h1>Jane</h1><p>jane@example.com</p>', 'css': ''}}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIsNone(response.json()['result']['scores']['jobMatch'])
        self.assertEqual(len(self.client.get('/api/cv/history/').json()), 1)
        self.client.force_login(User.objects.create_user(username='other-history'))
        self.assertEqual(self.client.get('/api/cv/history/').json(), [])
