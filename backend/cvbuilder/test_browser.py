"""Real browser + Django + Vite smoke test; no live cloud credentials used."""
import os
import json
import traceback
from django.core.signals import got_request_exception
from pathlib import Path
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
from unittest import skipUnless
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.sessions.backends.db import SessionStore
from django.test import LiveServerTestCase, override_settings
from playwright.sync_api import sync_playwright, expect

from . import oauth
from .test_workflow import TEST_SETTINGS, ProviderTransport


FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
VITE = FRONTEND / "node_modules/vite/bin/vite.js"
TEST_PORT = os.environ.get('CV_BROWSER_TEST_PORT', '5179')
ORIGIN = f"http://localhost:{TEST_PORT}"


@skipUnless(shutil.which("node") and VITE.exists(), "Browser test needs Node and frontend npm install")
@override_settings(**TEST_SETTINGS, CSRF_TRUSTED_ORIGINS=[ORIGIN], FRONTEND_URL=ORIGIN)
class BrowserWorkflowTests(LiveServerTestCase):
    def test_optional_photo_crop_modes_and_source_roundtrip(self):
        import io
        from PIL import Image
        from pypdf import PdfReader
        from .rendering import render_pdf
        User.objects.create_user(username='photo@example.com', email='photo@example.com', password='password123')
        buffer = io.BytesIO()
        Image.new('RGB', (240, 180), '#315cec').save(buffer, format='PNG')
        with sync_playwright() as playwright:
            with playwright.chromium.launch(headless=True, chromium_sandbox=True) as browser:
                page = browser.new_page()
                page.goto(ORIGIN + '/login')
                page.locator('input[type=email]').fill('photo@example.com')
                page.locator('input[type=password]').fill('password123')
                page.locator('button[type=submit]').click()
                page.wait_for_url('**/dashboard')
                page.goto(ORIGIN + '/cv-builder')
                page.locator('#cv-html').fill('<main><h1>Photo Tester</h1><p>Experience remains intact.</p></main>')
                upload = page.locator('#cv-photo-file')
                upload.set_input_files({'name':'bad.png', 'mimeType':'image/png', 'buffer':b'not an image'})
                expect(page.get_by_role('alert').filter(has_text='valid JPEG or PNG')).to_be_visible()
                upload.set_input_files({'name':'photo.png', 'mimeType':'image/png', 'buffer':buffer.getvalue()})
                expect(page.get_by_role('dialog')).to_be_visible()
                page.get_by_role('slider', name='Zoom', exact=True).fill('1.5')
                page.get_by_role('button', name='Apply Crop').click()
                expect(page.get_by_alt_text('Selected profile photo')).to_be_visible()
                frame = page.frame_locator('iframe[title="Live CV document"]')
                expect(frame.locator('#cv-profile-photo')).to_have_count(0)
                page.locator('#cv-photo-mode').select_option('visual')
                expect(frame.get_by_alt_text('Profile photo')).to_be_visible()
                self.assertGreater(float(frame.locator('body').evaluate('el => parseFloat(getComputedStyle(el).paddingLeft)')), 60)
                screenshots = FRONTEND.parent / 'artifacts' / 'cv-task-verification'
                screenshots.mkdir(parents=True, exist_ok=True)
                for width in (1280, 375):
                    page.set_viewport_size({'width': width, 'height': 900})
                    page.locator('.cv-photo-editor').screenshot(path=str(screenshots / f'photo-controls-{width}.png'))
                page.set_viewport_size({'width':1280, 'height':900})
                source = page.evaluate("async () => { const m = await import('/src/features/cv/photo.ts'); const html = document.querySelector('#cv-html').textContent; return {title:'Photo Test',html,css:''}; }")
                self.assertIn('Experience remains intact.', source['html'])
                visual_pdf = PdfReader(io.BytesIO(render_pdf(source)))
                self.assertTrue(any(page.images for page in visual_pdf.pages))
                # Re-enter persisted source to exercise reconstruction, not component state.
                page.locator('#cv-html').fill(source['html'])
                expect(page.get_by_alt_text('Selected profile photo')).to_be_visible()
                page.get_by_role('button', name='Crop / zoom photo').click()
                page.get_by_role('button', name='Cancel', exact=True).click()
                expect(page.get_by_alt_text('Selected profile photo')).to_be_visible()
                page.locator('#cv-photo-mode').select_option('ats')
                expect(frame.locator('img')).to_have_count(0)
                source['html'] = page.locator('#cv-html').text_content()
                ats_pdf = PdfReader(io.BytesIO(render_pdf(source)))
                self.assertTrue(all(not page.images for page in ats_pdf.pages))
                self.assertIn('Photo Tester', ats_pdf.pages[0].extract_text())
                page.get_by_role('button', name='Remove photo', exact=True).click()
                expect(page.get_by_alt_text('Selected profile photo')).to_have_count(0)

    def test_profile_download_exports_unsaved_text_without_changing_portfolio(self):
        import io
        from pypdf import PdfReader
        from profiles.models import Profile
        user = User.objects.create_user(username='resume@example.com', email='resume@example.com', password='password123')
        profile = Profile.objects.create(user=user, name='Resume Tester', title='Engineer', bio='Saved summary', slug='resume-tester', template_id='creative')
        with sync_playwright() as playwright:
            with playwright.chromium.launch(headless=True, chromium_sandbox=True) as browser:
                page = browser.new_page(accept_downloads=True)
                page.goto(ORIGIN + '/login')
                page.locator('input[type=email]').fill('resume@example.com')
                page.locator('input[type=password]').fill('password123')
                page.locator('button[type=submit]').click()
                page.wait_for_url('**/dashboard')
                page.goto(ORIGIN + f'/builder?id={profile.pk}')
                dropdown = page.get_by_role('combobox', name='CV document template')
                dropdown.focus()
                dropdown.press('ArrowDown')
                expect(dropdown).to_have_value('minimal')
                dropdown.select_option('professional')
                screenshots = FRONTEND.parent / 'artifacts' / 'cv-task-verification'
                screenshots.mkdir(parents=True, exist_ok=True)
                dropdown.screenshot(path=str(screenshots / 'professional-dropdown.png'))
                page.get_by_placeholder('Tell us about yourself...').fill('UNSAVED CV SUMMARY: Building reliable and accessible software.')
                expect(page.locator('.profile-preview')).to_contain_text('UNSAVED CV SUMMARY')
                before = page.locator('.profile-preview').inner_html()
                with page.expect_download(timeout=60000) as pending:
                    page.get_by_title('Download PDF Resume', exact=True).click()
                download = pending.value
                self.assertIsNone(download.failure())
                pdf = PdfReader(io.BytesIO(Path(download.path()).read_bytes()))
                text = '\n'.join(item.extract_text() for item in pdf.pages)
                self.assertIn('UNSAVED CV SUMMARY', text)
                self.assertIn('PROFESSIONAL SUMMARY', text)
                self.assertTrue(all(not page.images for page in pdf.pages))
                self.assertEqual(page.locator('.profile-preview').inner_html(), before)
                self.assertIn('template-creative', page.locator('.profile-preview').get_attribute('class'))

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.vite = subprocess.Popen([shutil.which("node"), str(VITE), "--host", "localhost", "--port", TEST_PORT, "--strictPort"],
                                    cwd=FRONTEND, env={**os.environ, "VITE_API_PROXY": cls.live_server_url},
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                with urlopen(ORIGIN, timeout=1):
                    return
            except OSError:
                if cls.vite.poll() is not None:
                    raise RuntimeError("Vite failed to start on test port 5179")
                time.sleep(.1)
        cls.vite.terminate()
        raise RuntimeError("Vite test server did not become ready")

    @classmethod
    def tearDownClass(cls):
        cls.vite.terminate()
        cls.vite.wait(timeout=10)
        super().tearDownClass()

    def test_browser_login_editor_preview_save_download_export_delete(self):
        server_errors = []
        def capture_exception(sender, **kwargs):
            server_errors.append(traceback.format_exc())
        got_request_exception.connect(capture_exception, weak=False)
        self.addCleanup(got_request_exception.disconnect, capture_exception)
        User.objects.create_user(username="browser@example.com", email="browser@example.com", password="password123")
        transport = ProviderTransport()
        with patch("cvbuilder.http.request", side_effect=transport), sync_playwright() as playwright:
            with playwright.chromium.launch(headless=True, chromium_sandbox=True) as browser:
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()
                page.goto(ORIGIN + "/login")
                page.locator('input[type="email"]').fill("browser@example.com")
                page.locator('input[type="password"]').fill("password123")
                page.locator('button[type="submit"]').click()
                page.wait_for_url("**/dashboard")
                page.wait_for_load_state("networkidle")
                cookies = context.cookies()
                cookie = next(c for c in cookies if c["name"] == "sessionid")
                self.assertTrue(cookie["httpOnly"])
                self.assertIsNone(page.evaluate("localStorage.getItem('profile_studio_token')"))
                page.goto("about:blank")
                # Test fixture connects providers server-side; OAuth protocol is tested separately.
                def connect_test_session():
                    session = SessionStore(session_key=cookie["value"])
                    for provider in ("google", "microsoft"):
                        oauth.store_tokens(session, provider, {"access_token": "test", "expires_in": 3600})
                    session.save()
                with ThreadPoolExecutor(max_workers=1) as executor:
                    executor.submit(connect_test_session).result()
                page.goto(ORIGIN + "/cv-builder")
                page.locator("#cv-title").fill("Browser CV")
                external = []
                page.on("request", lambda req: external.append(req.url) if "example.invalid" in req.url else None)
                page.locator("#cv-html").fill('<!doctype html><html><head><style>.cv-page{width:210mm;padding:15mm}</style></head><body><main class="cv-page">Own page margins</main></body></html>')
                full_frame = page.frame_locator('iframe[title="Live CV document"]')
                expect(full_frame.locator("main")).to_have_text("Own page margins")
                self.assertEqual(full_frame.locator("body").evaluate("el => getComputedStyle(el).paddingLeft"), "0px")
                page.locator("#cv-html").fill('<style>h1{color:navy}</style><div class="row"><div class="col"><h1>Browser Engineer</h1></div></div><img src="https://example.invalid/tracker"><script>parent.hacked=true</script>')
                frame = page.frame_locator('iframe[title="Live CV document"]')
                expect(frame.locator("h1")).to_have_text("Browser Engineer")
                self.assertGreater(float(frame.locator("body").evaluate("el => parseFloat(getComputedStyle(el).paddingLeft)")), 60)
                self.assertEqual(frame.locator(".row").evaluate("el => getComputedStyle(el).display"), "flex")
                self.assertEqual(external, [])
                self.assertIsNone(page.evaluate("window.hacked"))
                expect(page.get_by_role("button", name="Download PDF", exact=True)).to_be_disabled()
                import io
                from PIL import Image
                from pypdf import PdfReader
                photo = io.BytesIO()
                Image.new('RGB', (160, 160), '#315cec').save(photo, format='PNG')
                page.locator('#cv-photo-file').set_input_files({'name':'portrait.png', 'mimeType':'image/png', 'buffer':photo.getvalue()})
                page.get_by_role('button', name='Apply Crop').click()
                expect(page.get_by_role('dialog')).to_have_count(0)
                expect(page.get_by_alt_text('Selected profile photo')).to_be_visible()
                page.locator('#cv-photo-mode').select_option('visual')
                expect(frame.get_by_alt_text('Profile photo')).to_be_visible()
                page.get_by_role("button", name="Save to Google Drive", exact=True).click()
                expect(page.get_by_role("heading", name="Saved Preview", exact=True)).to_be_visible()
                page.reload()
                page.get_by_role("combobox", name="Choose a saved CV").select_option("file1")
                page.get_by_role("button", name="Open CV", exact=True).click()
                expect(page.get_by_role("heading", name="Saved Preview", exact=True)).to_be_visible()
                expect(page.frame_locator('iframe[title="Saved CV document"]').get_by_alt_text('Profile photo')).to_be_visible()
                with page.expect_download() as download:
                    page.get_by_role("button", name="Download PDF", exact=True).click()
                self.assertEqual(download.value.suggested_filename, "Browser CV.pdf")
                self.assertIsNone(download.value.failure())
                self.assertTrue(any(p.images for p in PdfReader(download.value.path()).pages))
                page.evaluate("""() => {
                    Object.defineProperty(navigator, 'canShare', {value: () => true, configurable: true});
                    Object.defineProperty(navigator, 'share', {value: async data => {
                        window.testSharedFile = {name: data.files[0].name, type: data.files[0].type};
                    }, configurable: true});
                }""")
                page.get_by_role("button", name="Share PDF", exact=True).click()
                expect(page.get_by_role("status").filter(has_text="PDF ready.")).to_be_visible()
                page.get_by_role("button", name="Share PDF", exact=True).click()
                page.wait_for_function("window.testSharedFile !== undefined")
                self.assertEqual(page.evaluate("window.testSharedFile"), {"name": "Browser CV.pdf", "type": "application/pdf"})
                page.evaluate("Object.defineProperty(navigator, 'canShare', {value: () => false, configurable: true})")
                with page.expect_download() as shared:
                    page.get_by_role("button", name="Share PDF", exact=True).click()
                self.assertEqual(shared.value.suggested_filename, "Browser CV.pdf")
                page.get_by_role("button", name="Export PDF to Google Drive", exact=True).click()
                expect(page.get_by_role("status").filter(has_text="PDF exported to Google Drive.")).to_be_visible()
                page.get_by_role("button", name="Export PDF to OneDrive", exact=True).click()
                expect(page.get_by_role("status").filter(has_text="PDF exported to OneDrive.")).to_be_visible()
                page.get_by_role("button", name="Edit CV", exact=True).click()
                expect(page.locator("#cv-html")).to_be_visible()
                self.assertIn("Browser Engineer", page.locator("#cv-html").inner_text())
                page.locator('#cv-css').fill('h1 { color: rgb(15, 90, 60); }')
                expect(page.frame_locator('iframe[title="Live CV document"]').locator('h1')).to_have_css('color', 'rgb(15, 90, 60)')
                page.get_by_role('button', name='Run ATS analysis', exact=True).click()
                expect(page.get_by_role('heading', name='Overall score:', exact=False)).to_be_visible()
                page.locator('#cv-job').fill('Required skills: Python, SQL. Preferred: Docker.')
                page.get_by_role('button', name='Run ATS analysis', exact=True).click()
                expect(page.get_by_text('Job requirements, gaps and matching evidence', exact=True)).to_be_visible()
                page.on("dialog", lambda dialog: dialog.accept())
                page.get_by_role("button", name="Delete saved CV", exact=True).click()
                expect(page.get_by_role("button", name="Download PDF", exact=True)).to_be_disabled()
                self.assertEqual(len(transport.pdfs), 2)
                # Exercise imports, current-source reanalysis, approved AI edits and original restore.
                with patch('cvbuilder.assets.AssetDrive.upload_asset', return_value='original-html'):
                    with page.expect_response('**/api/cv/imports/', timeout=65000) as imported:
                        page.locator('input[type=file][accept=".pdf,.docx,.html,.htm,.png,.jpg,.jpeg,.webp"]').set_input_files({
                            'name': 'uploaded.html', 'mimeType': 'text/html',
                            'buffer': b'<h1>Imported Engineer</h1><h2>Work Experience</h2><h3>Engineer at Example</h3><p>Worked on APIs</p><h2>Technical Skills</h2><p>Java</p>'})
                    self.assertEqual(imported.value.status, 201, '\n'.join(server_errors) or imported.value.text())
                    expect(page.frame_locator('iframe[title="Live CV document"]').locator('h1')).to_have_text('Imported Engineer')
                page.locator('#cv-html').fill('<h1>Imported Engineer</h1><p>new@example.com</p><h2>Work Experience</h2><h3>Engineer at Example</h3><p>Worked on APIs</p><h2>Technical Skills</h2><p>Python</p>')
                page.locator('#cv-job').fill('Required skills: Python')
                page.get_by_role('button', name='Run ATS analysis', exact=True).click()
                expect(page.get_by_text('Python — required · matched', exact=True)).to_be_visible()
                with override_settings(CV_AI_URL='https://ai.example.test/chat/completions', CV_AI_KEY='test', CV_AI_MODEL='test'), patch('cvbuilder.ai.http.request', return_value={'choices':[{'message':{'content':json.dumps({'suggestions':[{'original':'Worked on APIs','replacement':'Developed APIs','reason':'Clearer action verb','section':'Experience'}]})}}]}):
                    page.get_by_role('button', name='Generate AI suggestions', exact=True).click()
                    expect(page.locator('#suggestion-0')).to_have_value('Developed APIs')
                page.get_by_role('checkbox', name='Accept suggestion', exact=False).check()
                page.get_by_role('button', name='Apply selected suggestions', exact=True).click()
                expect(page.frame_locator('iframe[title="Live CV document"]').locator('body')).to_contain_text('Developed APIs')
                page.get_by_role('button', name='Restore original code', exact=True).click()
                expect(page.frame_locator('iframe[title="Live CV document"]').locator('body')).to_contain_text('Java')
                page.get_by_role('button', name='New CV', exact=True).click()
                expect(page.get_by_role('button', name='Restore before AI', exact=True)).to_have_count(0)
                expect(page.get_by_role('button', name='Restore original code', exact=True)).to_have_count(0)
                page.set_viewport_size({'width':390,'height':844})
                self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), 390)
                result = page.evaluate("""async () => {
                    const {applySuggestions} = await import('/src/features/cv/editing.ts');
                    const source = {title:'CV',html:'<p title="Worked on APIs">Worked on APIs &amp; tests</p>',css:'p {color:blue}'};
                    const updated=applySuggestions(source,[{original:'Worked on APIs',replacement:'Developed APIs'}]);
                    let repeatedRejected=false;
                    try {applySuggestions({...source,html:'<p>APIs</p><p>APIs</p>'},[{original:'APIs',replacement:'Services'}]);}
                    catch {repeatedRejected=true;}
                    return {updated,repeatedRejected};
                }""")
                self.assertEqual(result['updated']['html'], '<p title="Worked on APIs">Developed APIs &amp; tests</p>')
                self.assertEqual(result['updated']['css'], 'p {color:blue}')
                self.assertTrue(result['repeatedRejected'])
                page.goto(ORIGIN + "/tests/cv-preview.browser.html")
                expect(page.locator("#results")).to_contain_text("Preview is isolated")
                self.assertNotIn("FAIL", page.locator("#results").inner_text())
