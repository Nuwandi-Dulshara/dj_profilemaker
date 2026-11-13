from unittest.mock import patch
from django.test import SimpleTestCase


class PdfCacheTests(SimpleTestCase):
    def test_identical_source_reuses_pdf_but_edit_invalidates(self):
        from .rendering import render_pdf, clear_pdf_cache
        clear_pdf_cache()
        with patch('cvbuilder.rendering.render_pdf_uncached', side_effect=[b'%PDF-first', b'%PDF-second']) as renderer:
            source = {'title':'CV', 'html':'<h1>First</h1>', 'css':''}
            self.assertEqual(render_pdf(source), b'%PDF-first')
            self.assertEqual(render_pdf(source), b'%PDF-first')
            self.assertEqual(render_pdf({**source,'html':'<h1>Second</h1>'}), b'%PDF-second')
            self.assertEqual(renderer.call_count, 2)
        clear_pdf_cache()
