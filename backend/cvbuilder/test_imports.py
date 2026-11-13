import io
import zipfile
from types import SimpleNamespace
from unittest.mock import patch
from django.test import SimpleTestCase, override_settings
from .errors import CvError


class ImportTests(SimpleTestCase):
    def extract(self, data, name):
        from .extraction import extract_document
        return extract_document(data, name)

    def test_html_source_preserved_and_script_excluded_from_text(self):
        source = '<!doctype html><style>.row {color:red}</style><h1>A &amp; B</h1><script>secret()</script>'
        result = self.extract(source.encode(), 'cv.html')
        self.assertEqual(result['source']['html'], source)
        self.assertIn('A & B', result['text'])
        self.assertNotIn('secret', result['text'])
        self.assertEqual(result['conversion'], 'original-html')

    def test_docx_extracts_tables_headers_and_text(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as archive:
            archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Jane Engineer</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Python</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
            archive.writestr('word/header1.xml', '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>jane@example.com</w:t></w:r></w:p></w:hdr>')
        result = self.extract(stream.getvalue(), 'cv.docx')
        self.assertIn('Jane Engineer', result['text'])
        self.assertIn('Python', result['source']['html'])
        self.assertTrue(any('table' in item['id'] for item in result['issues']))
        self.assertTrue(any('header' in item['id'] for item in result['issues']))

    def test_rejects_corrupt_and_oversized_upload(self):
        for data, name in [(b'not pdf', 'cv.pdf'), (b'%PDF-1.7\ninvalid', 'cv.pdf'), (b'bad', 'cv.png'), (b'bad', 'cv.docx'), (b'bad', 'cv.exe')]:
            with self.assertRaises(CvError):
                self.extract(data, name)
        with override_settings(CV_UPLOAD_MAX_BYTES=4):
            with self.assertRaises(CvError):
                self.extract(b'12345', 'cv.txt')

    def test_reconstruction_escapes_text_and_identifies_sections(self):
        from .extraction import text_source
        result = text_source('Jane\nWork Experience\nBuilt <service> & APIs', 'CV')
        self.assertIn('<h2>Work Experience</h2>', result['html'])
        self.assertIn('&lt;service&gt; &amp; APIs', result['html'])

    def test_pdf_has_real_extracted_text(self):
        from reportlab.pdfgen.canvas import Canvas
        output = io.BytesIO()
        canvas = Canvas(output)
        canvas.drawString(70, 700, 'Jane Engineer Python')
        canvas.save()
        result = self.extract(output.getvalue(), 'cv.pdf')
        self.assertIn('Jane Engineer Python', result['text'])
        self.assertEqual(result['conversion'], 'reconstructed')

    def test_pdf_detects_ruled_tables_and_spatial_columns(self):
        from reportlab.pdfgen.canvas import Canvas
        output=io.BytesIO()
        canvas=Canvas(output)
        for y in [600, 620, 640]:
            canvas.line(50,y,350,y)
        for x in [50,200,350]:
            canvas.line(x,600,x,640)
        canvas.drawString(60,625,'Python')
        canvas.drawString(210,625,'SQL')
        for index in range(5):
            canvas.drawString(60,500-index*20,'Left experience')
            canvas.drawString(350,500-index*20,'Right education')
        canvas.save()
        result=self.extract(output.getvalue(),'cv.pdf')
        self.assertTrue(any(issue['id']=='pdf-tables' for issue in result['issues']))
        self.assertTrue(any(issue['id']=='pdf-columns' for issue in result['issues']))

    def test_image_ocr_exposes_uncertain_words_and_escapes_source(self):
        from PIL import Image
        output = io.BytesIO()
        Image.new('RGB', (40, 40), 'white').save(output, format='PNG')
        tsv = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t20\t10\t60\tJane\n'
        with patch('cvbuilder.extraction.subprocess.run', return_value=SimpleNamespace(returncode=0, stdout=tsv.encode())):
            result = self.extract(output.getvalue(), 'cv.png')
        self.assertEqual(result['text'], 'Jane')
        self.assertEqual(result['uncertain'], [{'text': 'Jane', 'confidence': 60.0}])
        self.assertEqual(result['mime'], 'image/png')

    def test_ocr_configuration_failure_is_explicit(self):
        from PIL import Image
        output = io.BytesIO()
        Image.new('RGB', (20, 20)).save(output, format='PNG')
        with patch('cvbuilder.extraction.subprocess.run', side_effect=FileNotFoundError):
            with self.assertRaises(CvError) as error:
                self.extract(output.getvalue(), 'cv.png')
        self.assertEqual(error.exception.status_code, 503)

    @override_settings(SETTINGS_MODULE=None)
    def test_worker_runs_when_settings_wrapper_has_no_module_name(self):
        from .extraction_runner import extract_upload
        self.assertEqual(extract_upload(b'<h1>Jane</h1>', 'cv.html')['text'], 'Jane')
