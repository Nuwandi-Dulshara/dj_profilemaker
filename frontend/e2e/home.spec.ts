import { test, expect } from '@playwright/test';

for (const width of [320, 390, 768, 1440]) {
  test(`home fits ${width}px and section navigation works`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width < 900) await page.getByRole('button', { name: 'Open navigation' }).click();
    const nav = page.getByRole('navigation', { name: width < 900 ? 'Mobile navigation' : 'Main navigation' });
    await nav.getByRole('link', { name: 'Features', exact: true }).click();
    await expect(page).toHaveURL(/#features$/);
    await expect(page.getByRole('heading', { name: 'Everything You Need to Build Your Career Documents' })).toBeInViewport();
    await page.goto('/');
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
  });
}

test('mobile menu dismisses with keyboard and does not leave invisible links focusable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  await toggle.click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
});

test('reduced motion and unknown route recovery', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  await page.goto('/unknown-page');
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('/');
});
