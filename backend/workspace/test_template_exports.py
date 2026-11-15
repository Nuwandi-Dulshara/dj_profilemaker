import json
from types import SimpleNamespace
from django.test import SimpleTestCase
from .documents import generate_project_files


class TemplateSourceExportTests(SimpleTestCase):
    def test_source_package_uses_shared_renderer_and_preserves_full_document(self):
        content = {'personal': {'name': 'Export Person'}, 'experience': [{'id': '1', 'role': 'Engineer'}], 'custom': [{'id': '2', 'title': 'Preserved'}]}
        design = {'layout': 'sidebar', 'headings': {'experience': 'Career'}, 'templateId': 'creative-sidebar'}
        files = generate_project_files(SimpleNamespace(title='Test CV'), SimpleNamespace(content=content, design=design))
        self.assertEqual(json.loads(files['cv.json']), {'content': content, 'design': design})
        self.assertIn('CvDocument.tsx', files)
        self.assertIn('schema.ts', files)
        self.assertIn('package.json', files)
        self.assertIn('CvDocument', files['CV.tsx'])
        self.assertIn('react', json.loads(files['package.json'])['dependencies'])
