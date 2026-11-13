import io
from django.test import TestCase
from rest_framework.test import APIClient
from pypdf import PdfReader


def sample_profile():
    return {'name': 'Alex Morgan', 'title': 'Software Engineer', 'bio': 'Builds reliable software and accessible applications.',
            'email': 'alex@example.com', 'phone': '+94 77 123 4567', 'location': 'Colombo, Sri Lanka',
            'photo': 'https://example.invalid/photo.png', 'template_id': 'creative',
            'links': [{'platform': 'GitHub', 'url': 'https://github.com/alex'}],
            'skills': [{'name': 'Python', 'level': 93}, {'name': 'TypeScript', 'level': 87}],
            'experiences': [{'role': 'Software Engineer', 'company': 'Example Systems', 'startDate': '2020', 'endDate': '', 'current': True,
                             'description': 'Developed APIs.\nMaintained automated tests.'}],
            'education': [{'degree': 'BSc', 'institution': 'Example University', 'fieldOfStudy': 'Computer Science', 'startDate': '2016', 'endDate': '2020'}],
            'projects': [{'title': 'Inventory Service', 'description': 'Tracks stock changes.', 'tags': 'Django, PostgreSQL',
                          'demoUrl': 'https://example.com/inventory', 'githubUrl': 'https://github.com/alex/inventory'}]}


class ResumePdfTests(TestCase):
    def test_selected_template_controls_resume_design(self):
        from .resume_pdf import resume_source

        profile = sample_profile()
        creative = resume_source(profile)
        profile['template_id'] = 'professional'
        professional = resume_source(profile)

        self.assertIn('class="resume-template-creative"', creative['html'])
        self.assertIn('--resume-accent:#8646d5', creative['css'])
        self.assertIn('class="resume-template-professional"', professional['html'])
        self.assertIn('--resume-accent:#1e3a8a', professional['css'])
        self.assertNotEqual(creative['css'], professional['css'])

    def test_unknown_template_is_rejected(self):
        from .resume_pdf import resume_source
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            resume_source({'name': 'Alex', 'template_id': 'unknown'})

    def test_blank_optional_entries_do_not_create_empty_sections(self):
        from .resume_pdf import resume_source
        source = resume_source({'name': 'Alex', 'experiences': [{'role': '  ', 'description': '\n'}],
                                'education': [{'degree': ' '}], 'projects': [{'title': ' '}]})
        self.assertNotIn('<section>', source['html'])

    def test_download_uses_current_profile_and_text_not_portfolio_images(self):
        response = APIClient().post('/api/profiles/resume/', sample_profile(), format='json')
        self.assertEqual(response.status_code, 200, response.content[:300])
        reader = PdfReader(io.BytesIO(response.content))
        text = '\n'.join(page.extract_text() for page in reader.pages)
        for value in ['Alex Morgan', 'Professional Summary', 'Work Experience', 'Education', 'Technical Skills', 'Projects',
                      'Contact Information', 'alex@example.com', 'Computer Science', 'Present', 'TypeScript', 'PostgreSQL',
                      'https://github.com/alex/inventory', 'Maintained automated tests.']:
            self.assertIn(value.casefold(), text.casefold())
        self.assertNotIn('93%', text)
        self.assertEqual(len(reader.pages), 1)
        self.assertTrue(all(len(page.images) == 0 for page in reader.pages))
        self.assertAlmostEqual(float(reader.pages[0].mediabox.width), 595.28, delta=1)
        self.assertAlmostEqual(float(reader.pages[0].mediabox.height), 841.89, delta=1)
        self.assertEqual(response['Cache-Control'], 'no-store')
        urls = [annotation.get_object().get('/A', {}).get('/URI') for page in reader.pages for annotation in page.get('/Annots', [])]
        self.assertIn('https://github.com/alex/inventory', urls)

    def test_long_descriptions_wrap_and_all_entries_reach_final_page(self):
        profile = sample_profile()
        profile['experiences'] = [dict(profile['experiences'][0], role=f'Engineer role {index}',
            description=('Maintained the application with careful testing and complete documentation. ' * 15) + f'END-ENTRY-{index}') for index in range(9)]
        profile['projects'][-1]['description'] = 'FINAL-PROJECT-CONTENT'
        response = APIClient().post('/api/profiles/resume/', profile, format='json')
        self.assertEqual(response.status_code, 200, response.content[:300])
        reader = PdfReader(io.BytesIO(response.content))
        text = '\n'.join(page.extract_text() for page in reader.pages)
        self.assertGreater(len(reader.pages), 1)
        for index in range(9):
            self.assertIn(f'END-ENTRY-{index}', text)
        self.assertIn('FINAL-PROJECT-CONTENT', text)
        self.assertTrue(all(page.extract_text().strip() for page in reader.pages))

    def test_invalid_profile_rejected_without_rendering(self):
        response = APIClient().post('/api/profiles/resume/', {'name': 'Name', 'skills': 'invalid'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_single_entry_larger_than_a_page_still_flows(self):
        profile = sample_profile()
        profile['experiences'][0]['description'] = ('Long experience description with readable text. ' * 450) + ' FINAL-LONG-ENTRY'
        response = APIClient().post('/api/profiles/resume/', profile, format='json')
        self.assertEqual(response.status_code, 200)
        reader = PdfReader(io.BytesIO(response.content))
        self.assertGreater(len(reader.pages), 1)
        text = '\n'.join(page.extract_text() for page in reader.pages)
        self.assertIn('FINAL-LONG-ENTRY', text.replace('\n', ''))
        self.assertIn('Inventory Service', text)

    def test_user_text_cannot_inject_pdf_layout_or_active_urls(self):
        from .resume_pdf import resume_source
        data = sample_profile()
        data['bio'] = '<style>body{display:none}</style>Engineering & testing'
        data['links'].append({'platform': 'Unsafe', 'url': 'javascript:alert(1)'})
        source = resume_source(data)
        self.assertIn('&lt;style&gt;body{display:none}&lt;/style&gt;Engineering &amp; testing', source['html'])
        self.assertNotIn('javascript:alert(1)', [item['url'] for item in source['links']])
