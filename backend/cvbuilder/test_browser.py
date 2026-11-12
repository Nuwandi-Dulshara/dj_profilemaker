"""Real browser + Django + Vite smoke test; no live cloud credentials used."""
import os
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
ORIGIN = "http://localhost:5179"


@skipUnless(shutil.which("node") and VITE.exists(), "Browser test needs Node and frontend npm install")
@override_settings(**TEST_SETTINGS, CSRF_TRUSTED_ORIGINS=[ORIGIN], FRONTEND_URL=ORIGIN)
class BrowserWorkflowTests(LiveServerTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.vite = subprocess.Popen([shutil.which("node"), str(VITE), "--host", "localhost", "--port", "5179", "--strictPort"],
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
                page.get_by_role("button", name="Save to Google Drive", exact=True).click()
                expect(page.get_by_role("heading", name="Saved Preview", exact=True)).to_be_visible()
                page.reload()
                page.get_by_role("combobox", name="Choose a saved CV").select_option("file1")
                page.get_by_role("button", name="Open CV", exact=True).click()
                expect(page.get_by_role("heading", name="Saved Preview", exact=True)).to_be_visible()
                with page.expect_download() as download:
                    page.get_by_role("button", name="Download PDF", exact=True).click()
                self.assertEqual(download.value.suggested_filename, "Browser CV.pdf")
                self.assertIsNone(download.value.failure())
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
                self.assertIn("Browser Engineer", page.locator("#cv-html").input_value())
                page.on("dialog", lambda dialog: dialog.accept())
                page.get_by_role("button", name="Delete saved CV", exact=True).click()
                expect(page.get_by_role("button", name="Download PDF", exact=True)).to_be_disabled()
                self.assertEqual(len(transport.pdfs), 2)
                page.goto(ORIGIN + "/tests/cv-preview.browser.html")
                expect(page.locator("#results")).to_contain_text("Preview is isolated")
                self.assertNotIn("FAIL", page.locator("#results").inner_text())
