import io
import zipfile
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import CareerProfile, Document, DocumentVersion, Project


@override_settings(SECURE_SSL_REDIRECT=False)
class AdvancedCvDocumentTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user('cv@example.test', 'Phrase-Safe!123', first_name='Sam', last_name='Lee')
        self.other = User.objects.create_user('cv2@example.test', 'Phrase-Safe!123')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)

    def send(self, method, path, data=None):
        token = self.client.get('/api/auth/csrf/').json()['csrfToken']
        return getattr(self.client, method)(path, data or {}, format='json', HTTP_X_CSRFTOKEN=token)

    def create(self, **extra):
        res = self.send('post', '/api/advanced-cv/', {'title': 'My CV', 'content': {'summary': 'Hello'}, **extra})
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()['id']

    def test_create_makes_owned_advanced_cv_with_document(self):
        pid = self.create(kind='cover_letter')
        project = Project.objects.get(pk=pid)
        self.assertEqual(project.kind, 'advanced_cv')
        self.assertEqual(project.owner, self.user)
        self.assertEqual(project.document.content, {'summary': 'Hello'})
        self.assertEqual(self.send('post', '/api/advanced-cv/', {'title': '  '}).status_code, 400)
        self.assertEqual(self.send('post', '/api/advanced-cv/', {'title': 'X', 'design': {'pageSize': 'Tabloid'}}).status_code, 400)

    def test_autosave_requires_current_revision_and_conflicts_when_stale(self):
        pid = self.create()
        doc = self.client.get(f'/api/projects/{pid}/document/').json()
        self.assertEqual(doc['revision'], 1)
        ok = self.send('put', f'/api/projects/{pid}/document/', {'content': {'summary': 'New'}, 'design': {'pageSize': 'Letter'}, 'revision': 1})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()['revision'], 2)
        stale = self.send('put', f'/api/projects/{pid}/document/', {'content': {'summary': 'Old'}, 'design': {}, 'revision': 1})
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json()['revision'], 2)
        self.assertEqual(Document.objects.get(project_id=pid).content, {'summary': 'New'})
        self.assertEqual(self.send('put', f'/api/projects/{pid}/document/', {'content': {}, 'design': {}}).status_code, 400)

    def test_design_validation(self):
        pid = self.create()
        for design in ({'accent': 'red'}, {'fontFamily': 'Comic Sans'}, {'margin': 500}, {'order': ['bogus']}):
            res = self.send('put', f'/api/projects/{pid}/document/', {'content': {}, 'design': design, 'revision': 1})
            self.assertEqual(res.status_code, 400, design)

    def test_other_users_cannot_read_write_or_version(self):
        pid = self.create()
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/projects/{pid}/document/').status_code, 404)
        self.assertEqual(self.send('put', f'/api/projects/{pid}/document/', {'content': {}, 'design': {}, 'revision': 1}).status_code, 404)
        self.assertEqual(self.client.get(f'/api/projects/{pid}/versions/').status_code, 404)
        self.assertEqual(self.send('post', f'/api/projects/{pid}/versions/', {'name': 'x'}).status_code, 404)
        self.assertEqual(self.client.get(f'/api/projects/{pid}/ats-check/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/projects/{pid}/content-analysis/').status_code, 404)
        self.assertEqual(self.send('post', f'/api/projects/{pid}/job-match/', {'job_description': 'Looking for Python Django React developer'}).status_code, 404)
        self.assertEqual(self.client.get(f'/api/projects/{pid}/export/zip/').status_code, 404)

    def test_deleted_projects_cannot_be_edited(self):
        pid = self.create()
        self.send('post', f'/api/projects/{pid}/delete/')
        self.assertEqual(self.client.get(f'/api/projects/{pid}/document/').status_code, 404)

    def test_versions_snapshot_and_restore_create_new_revision(self):
        pid = self.create()
        v = self.send('post', f'/api/projects/{pid}/versions/', {'name': 'First draft'}).json()
        self.send('put', f'/api/projects/{pid}/document/', {'content': {'summary': 'Changed'}, 'design': {}, 'revision': 1})
        restored = self.send('post', f'/api/projects/{pid}/versions/{v["id"]}/restore/')
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()['content'], {'summary': 'Hello'})
        self.assertEqual(restored.json()['revision'], 3)
        names = [x['name'] for x in self.client.get(f'/api/projects/{pid}/versions/').json()]
        self.assertIn('First draft', names)
        self.assertTrue(any(n.startswith('Before restoring') for n in names))
        self.assertEqual(DocumentVersion.objects.filter(document__project_id=pid).count(), 2)
        self.assertEqual(self.send('post', f'/api/projects/{pid}/versions/99999/restore/').status_code, 404)

    def test_ats_check_and_content_analysis(self):
        pid = self.create(content={
            'personal': {'name': 'Sam Lee', 'email': 'sam@example.test', 'phone': '555-0100'},
            'summary': 'Helped build backend services.',
            'experience': [{'id': '1', 'role': 'Engineer', 'company': 'Acme', 'description': 'Helped with API development.'}],
        })
        ats = self.client.get(f'/api/projects/{pid}/ats-check/').json()
        self.assertIn('score', ats)
        self.assertIn('checks', ats)
        self.assertIn('disclaimer', ats)

        analysis = self.client.get(f'/api/projects/{pid}/content-analysis/').json()
        self.assertIn('findings', analysis)
        self.assertIn('suggestions', analysis)
        self.assertTrue(any(f['category'] == 'Action verbs' and f['severity'] == 'warning' for f in analysis['findings']))

    def test_job_matcher_and_tailored_cv_never_overwrite_source(self):
        pid = self.create(content={
            'personal': {'name': 'Sam Lee'},
            'summary': 'Senior Python and Django engineer',
            'skills': [{'id': 's1', 'name': 'Python'}],
        })
        jd = 'We are hiring a Senior Software Engineer with Python, Django, PostgreSQL, React, and TypeScript expertise.'
        match = self.send('post', f'/api/projects/{pid}/job-match/', {'job_description': jd})
        self.assertEqual(match.status_code, 200)
        data = match.json()
        self.assertIn('Python', data['matched_keywords'])
        self.assertTrue(any(k.lower() == 'postgresql' for k in data['missing_keywords']))

        tailored = self.send('post', f'/api/projects/{pid}/tailored-cv/', {'job_description': jd, 'title': 'Sam Lee - Tailored CV'})
        self.assertEqual(tailored.status_code, 201)
        new_id = tailored.json()['id']
        self.assertNotEqual(new_id, pid)

        source_doc = Document.objects.get(project_id=pid)
        self.assertEqual(len(source_doc.content['skills']), 1)

        tailored_doc = Document.objects.get(project_id=new_id)
        self.assertGreater(len(tailored_doc.content['skills']), 1)

    def test_career_profile_import_and_zip_export(self):
        CareerProfile.objects.create(
            owner=self.user,
            summary='Vault summary text',
            skills=[{'id': 'v1', 'name': 'PostgreSQL', 'category': 'Database'}],
        )
        pid = self.create(content={'personal': {'name': ''}, 'summary': ''})
        imp = self.send('post', f'/api/projects/{pid}/import-profile/', {'sections': ['personal', 'summary', 'skills']})
        self.assertEqual(imp.status_code, 200)
        doc_data = imp.json()
        self.assertEqual(doc_data['content']['summary'], 'Vault summary text')
        self.assertEqual(doc_data['content']['personal']['name'], 'Sam Lee')
        self.assertEqual(doc_data['content']['skills'][0]['name'], 'PostgreSQL')

        files_res = self.client.get(f'/api/projects/{pid}/files/')
        self.assertEqual(files_res.status_code, 200)
        self.assertIn('CV.tsx', files_res.json()['files'])

        zip_res = self.client.get(f'/api/projects/{pid}/export/zip/')
        self.assertEqual(zip_res.status_code, 200)
        self.assertEqual(zip_res['Content-Type'], 'application/zip')
        with zipfile.ZipFile(io.BytesIO(zip_res.content), 'r') as zf:
            self.assertIn('CV.tsx', zf.namelist())
            self.assertIn('style.css', zf.namelist())
            self.assertIn('cv.json', zf.namelist())
