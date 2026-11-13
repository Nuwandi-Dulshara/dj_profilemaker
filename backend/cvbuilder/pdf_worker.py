"""One ephemeral browser per render. Source arrives over stdin, PDF leaves stdout."""
import sys

from playwright.sync_api import sync_playwright


def main():
    html = sys.stdin.buffer.read().decode("utf-8")
    with sync_playwright() as playwright:
        with playwright.chromium.launch(headless=True, chromium_sandbox=True) as browser:
            context = browser.new_context(java_script_enabled=False, service_workers="block", accept_downloads=False,
                                          viewport={"width": 794, "height": 1123})
            context.route("**/*", lambda route: route.abort())
            page = context.new_page()
            page.set_default_timeout(20000)
            page.set_content(html, wait_until="load", timeout=20000)
            page.emulate_media(media="print")
            # Evaluation is our fixed code, not user scripts. Wait for embedded images.
            page.evaluate("async () => { await document.fonts.ready; await Promise.all(Array.from(document.images, i => i.decode().catch(() => {}))); }")
            # Chromium can honor named-page orientation even with preferCSSPageSize
            # disabled. Normalize only paper descriptors using the browser's CSS
            # parser, retaining authored margins, page breaks and all other styles.
            page.evaluate("""() => {
                const normalize = rules => {
                    for (const rule of rules) {
                        if (rule.type === CSSRule.PAGE_RULE) {
                            rule.style.setProperty('size', 'A4', 'important');
                            rule.style.setProperty('page-orientation', 'upright', 'important');
                        }
                        if (rule.cssRules) normalize(rule.cssRules);
                    }
                };
                for (const sheet of document.styleSheets) normalize(sheet.cssRules);
            }""")
            pdf = page.pdf(format="A4", print_background=True, prefer_css_page_size=True)
            sys.stdout.buffer.write(pdf)


if __name__ == "__main__":
    main()
