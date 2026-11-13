import json
from unittest.mock import patch
from django.test import SimpleTestCase, override_settings
from .ai import improve
from .errors import CvError


@override_settings(CV_AI_URL='https://ai.example.test/chat/completions', CV_AI_KEY='private-key', CV_AI_MODEL='configured-model')
class AiTests(SimpleTestCase):
    source = {'title': 'CV', 'html': '<p>Worked on APIs</p>', 'css': ''}

    def response(self, suggestions):
        return {'choices': [{'message': {'content': json.dumps({'suggestions': suggestions})}}]}

    def test_suggestions_require_review_and_added_metrics_are_rejected(self):
        suggestions = [{'original': 'Worked on APIs', 'replacement': 'Developed APIs', 'reason': 'Stronger wording'},
                       {'original': 'Worked on APIs', 'replacement': 'Improved APIs by 40%'}]
        with patch('cvbuilder.ai.http.request', return_value=self.response(suggestions)):
            result = improve(self.source)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['replacement'], 'Developed APIs')
        self.assertTrue(result[0]['requiresConfirmation'])

    def test_unknown_original_or_html_response_rejected(self):
        for item in [{'original': 'Never happened', 'replacement': 'Changed'}, {'original': 'Worked on APIs', 'replacement': '<script>bad()</script>'}]:
            with patch('cvbuilder.ai.http.request', return_value=self.response([item])):
                with self.assertRaises(CvError):
                    improve(self.source)

    def test_new_skill_or_degree_claim_is_not_suggested(self):
        suggestions = [{'original': 'Worked on APIs', 'replacement': 'Built APIs using Kubernetes'},
                       {'original': 'Worked on APIs', 'replacement': 'Built APIs with a PhD in computing'}]
        with patch('cvbuilder.ai.http.request', return_value=self.response(suggestions)):
            self.assertEqual(improve(self.source), [])

    @override_settings(CV_AI_URL='http://ai.example.test')
    def test_insecure_endpoint_rejected(self):
        with self.assertRaises(CvError):
            improve(self.source)
