import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import Document, DocumentVersion, Project


@override_settings(SECURE_SSL_REDIRECT=False)
class TemplateTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('templates@example.test', 'Safe-Phrase!123')
        self.other = get_user_model().objects.create_user('other-template@example.test', 'Safe-Phrase!123')
        self.client = APIClient()
        self.client.force_login(self.user)

    def post(self, path, data):
        return self.client.post('/api/' + path, data, format='json')

    def create(self, **extra):
        response = self.post('projects/', {'kind': 'template_cv', 'title': 'Template CV', 'template_id': 'classic-ats', 'idempotency_key': str(uuid.uuid4()), **extra})
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()['id']

    def test_catalogue_and_combined_filters_and_pagination(self):
        response = self.client.get('/api/templates/?page_size=50')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 12)
        self.assertEqual({x['name'] for x in data['results']}, {'Classic ATS', 'Simple Professional', 'Clean Graduate', 'Executive Standard', 'Modern Navy', 'Minimal Green', 'Contemporary Professional', 'Technical Developer', 'Creative Sidebar', 'Elegant Portfolio', 'Academic Research CV', 'Teacher Professional CV'})
        result = self.client.get('/api/templates/?search=classic&category=ATS-Friendly&layout=single&ats_risk=low').json()
        self.assertEqual([x['id'] for x in result['results']], ['classic-ats'])
        page = self.client.get('/api/templates/?page_size=2').json()
        self.assertEqual(len(page['results']), 2)
        self.assertIsNotNone(page['next'])

    def test_favorites_and_recent_are_owner_scoped(self):
        self.assertEqual(self.post('templates/classic-ats/favorite/', {'favorite': True}).status_code, 200)
        self.assertEqual(self.client.get('/api/templates/?favorite=true').json()['count'], 1)
        self.create()
        self.assertEqual(self.client.get('/api/templates/?recent=true').json()['count'], 1)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get('/api/templates/?favorite=true').json()['count'], 0)
        self.assertEqual(self.client.get('/api/templates/?recent=true').json()['count'], 0)

    def test_creation_is_idempotent_and_blank(self):
        key = str(uuid.uuid4())
        pid = self.create(idempotency_key=key)
        again = self.post('projects/', {'kind': 'template_cv', 'title': 'Template CV', 'template_id': 'classic-ats', 'idempotency_key': key})
        self.assertIn(again.status_code, [200, 201])
        self.assertEqual(again.json()['id'], pid)
        self.assertEqual(Project.objects.count(), 1)
        self.assertEqual(Document.objects.get(project_id=pid).content, {})
        self.assertEqual(Document.objects.get(project_id=pid).design['templateId'], 'classic-ats')
        self.assertEqual(self.post('projects/', {'kind': 'template_cv', 'title': 'Different', 'template_id': 'classic-ats', 'idempotency_key': key}).status_code, 409)

    def test_private_crud_duplicate_and_validation(self):
        response = self.post('my-templates/', {'name': 'Custom', 'design': {'layout': 'sidebar', 'textColor': '#112233'}})
        self.assertEqual(response.status_code, 201, response.content)
        tid = response.json()['id']
        self.assertEqual(self.client.patch(f'/api/my-templates/{tid}/', {'name': 'Renamed'}, format='json').json()['name'], 'Renamed')
        duplicate = self.post(f'my-templates/{tid}/duplicate/', {})
        self.assertEqual(duplicate.status_code, 201)
        self.assertNotEqual(duplicate.json()['id'], tid)
        for design in [{'layout': 'evil'}, {'lineHeight': False}, {'headings': {'bogus': 'Oops'}}, {'order': [{}]}, {'code': 'alert(1)'}, {'pageBreaks': ['evil']}]:
            self.assertEqual(self.post('my-templates/', {'name': 'Bad', 'design': design}).status_code, 400, design)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get('/api/my-templates/').json()['count'], 0)
        self.assertEqual(self.client.get(f'/api/templates/{tid}/').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/my-templates/{tid}/', {'name': 'No'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/my-templates/{tid}/').status_code, 404)
        self.assertEqual(self.post(f'my-templates/{tid}/duplicate/', {}).status_code, 404)
        self.client.force_login(self.user)
        self.assertEqual(self.client.delete(f'/api/my-templates/{tid}/').status_code, 204)

    def test_switch_preserves_content_and_snapshots_and_rejects_stale(self):
        pid = self.create()
        document = Document.objects.get(project_id=pid)
        document.content = {'summary': 'Keep me', 'custom': [{'id': 'x', 'text': 'Never lose'}], 'future': {'nested': True}}
        document.save()
        content, design = document.content, document.design
        response = self.post(f'projects/{pid}/switch-template/', {'template_id': 'creative-sidebar', 'revision': 1})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['content'], content)
        self.assertEqual(response.json()['revision'], 2)
        version = DocumentVersion.objects.get(document=document)
        self.assertEqual(version.content, content)
        self.assertEqual(version.design, design)
        self.assertEqual(self.post(f'projects/{pid}/switch-template/', {'template_id': 'classic-ats', 'revision': 1}).status_code, 409)
        self.assertEqual(DocumentVersion.objects.count(), 1)
        ats = self.client.get(f'/api/projects/{pid}/ats-check/').json()
        self.assertEqual(next(x for x in ats['checks'] if 'columns' in x['category'])['status'], 'warning')
        self.client.force_login(self.other)
        self.assertEqual(self.post(f'projects/{pid}/switch-template/', {'template_id': 'classic-ats', 'revision': 2}).status_code, 404)

    def test_shared_validation_handles_malformed_json_and_profile_import(self):
        for design in [{'pageSize': []}, {'fontFamily': {}}, {'lineHeight': 5}, {'sectionSpacing': 4}, {'headings': []}, {'hidden': [{}]}]:
            response = self.post('advanced-cv/', {'title': 'Bad', 'design': design})
            self.assertEqual(response.status_code, 400, design)
        from .models import CareerProfile
        CareerProfile.objects.create(owner=self.user, summary='My own profile', skills=[{'id': 'skill', 'name': 'Python'}])
        pid = self.create(import_profile=True)
        document = Document.objects.get(project_id=pid)
        self.assertEqual(document.content['summary'], 'My own profile')
        self.assertEqual(document.content['skills'][0]['name'], 'Python')
        self.assertEqual(self.post('projects/', {'title': 'No key', 'kind': 'template_cv', 'template_id': 'classic-ats'}).status_code, 400)
        self.client.force_login(self.other)
        other_pid = self.create()
        self.assertEqual(Document.objects.get(project_id=other_pid).content, {})

    def test_retry_defaults_and_owner_key_namespace(self):
        key = str(uuid.uuid4())
        pid = self.create(idempotency_key=key)
        retry = self.post('projects/', {'kind': 'template_cv', 'title': 'Template CV', 'template_id': 'classic-ats', 'idempotency_key': key, 'import_profile': False})
        self.assertEqual(retry.status_code, 200, retry.content)
        self.assertEqual(retry.json()['id'], pid)
        self.client.force_login(self.other)
        self.assertNotEqual(self.create(idempotency_key=key), pid)

    def test_creation_accepts_validated_customization_and_keys_include_design(self):
        key = str(uuid.uuid4())
        pid = self.create(idempotency_key=key, design={'accent': '#334455', 'layout': 'sidebar', 'templateId': 'forged'})
        design = Document.objects.get(project_id=pid).design
        self.assertEqual(design['accent'], '#334455')
        self.assertEqual(design['layout'], 'sidebar')
        self.assertEqual(design['templateId'], 'classic-ats')
        retry = self.post('projects/', {'kind': 'template_cv', 'title': 'Template CV', 'template_id': 'classic-ats', 'idempotency_key': key, 'design': {'accent': '#445566'}})
        self.assertEqual(retry.status_code, 409)
        for design in [{'accent': 'red'}, {'code': 'execute'}, []]:
            response = self.post('projects/', {'kind': 'template_cv', 'title': 'Bad design', 'template_id': 'classic-ats', 'idempotency_key': str(uuid.uuid4()), 'design': design})
            self.assertEqual(response.status_code, 400)
    def test_switch_applies_validated_preview_design_without_changing_snapshot(self):
        pid = self.create()
        original = Document.objects.get(project_id=pid)
        old_design = original.design
        response = self.post(f'projects/{pid}/switch-template/', {'template_id': 'modern-navy', 'revision': 1, 'design': {'accent': '#334455', 'layout': 'sidebar', 'templateId': 'forged'}})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['design']['accent'], '#334455')
        self.assertEqual(response.json()['design']['layout'], 'sidebar')
        self.assertEqual(response.json()['design']['templateId'], 'modern-navy')
        self.assertEqual(DocumentVersion.objects.get(document=original).design, old_design)
        for design in [{'accent': 'red'}, {'code': 'execute'}, []]:
            response = self.post(f'projects/{pid}/switch-template/', {'template_id': 'classic-ats', 'revision': 2, 'design': design})
            self.assertEqual(response.status_code, 400, response.content)
        original.refresh_from_db()
        self.assertEqual(original.revision, 2)
        self.assertEqual(DocumentVersion.objects.filter(document=original).count(), 1)
