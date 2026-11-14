import { test, expect } from '@playwright/test';

test('registers, persists a session after refresh, logs out, and signs in', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('First Name', { exact: true }).fill('Alex');
  await page.getByLabel('Last Name', { exact: true }).fill('Morgan');
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Clear-River!Strange-82');
  await page.getByLabel('Confirm Password', { exact: true }).fill('Clear-River!Strange-82');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: /Welcome( back)?, Alex/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Welcome( back)?, Alex/ })).toBeVisible();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Clear-River!Strange-82');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
});

for (const width of [390, 768, 1440]) {
  test(`auth pages fit ${width}px with shared sea layout`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/login', '/register', '/forgot-password', '/reset-password/invalid/invalid']) {
      await page.goto(route);
      await expect(page.locator('.auth-card')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto('/register');
    await page.screenshot({ path: `test-results/auth-${width}.png`, fullPage: true });
  });
}

test('shows honest API errors and generic development password reset status', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address', { exact: true }).fill('absent@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Incorrect-Password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('email or password is incorrect');
  await page.getByRole('link', { name: 'Forgot Password?' }).click();
  await page.getByLabel('Email Address', { exact: true }).fill('absent@example.test');
  await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('development email backend');
});
