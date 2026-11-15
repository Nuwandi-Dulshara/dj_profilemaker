import { test, expect } from '@playwright/test';

test('creates an Advanced CV, edits with live preview, autosaves, versions, restores, and runs ATS/Matcher/Code tools', async ({ page }) => {
  const email = `cv-${Date.now()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('First Name', { exact: true }).fill('Jordan');
  await page.getByLabel('Last Name', { exact: true }).fill('Fox');
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Clear-River!Strange-82');
  await page.getByLabel('Confirm Password', { exact: true }).fill('Clear-River!Strange-82');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');

  // New Project dialog now routes to the real builder
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('button', { name: /Advanced CV Builder/ }).click();
  await expect(page).toHaveURL('/dashboard/advanced-cv/new');
  await page.getByLabel('Project name').fill('Jordan Fox CV');
  await page.getByRole('button', { name: 'Create CV' }).click();
  await expect(page).toHaveURL(/\/dashboard\/advanced-cv\/[0-9a-f-]{36}$/);
  const editorUrl = page.url();

  // Edit: live preview updates, autosave completes
  await page.getByLabel('Full name').fill('Jordan Fox');
  await expect(page.getByRole('heading', { name: 'Jordan Fox', level: 1 })).toBeVisible();
  await expect(page.getByText('Unsaved changes…')).toBeVisible();
  await expect(page.getByText('All changes saved')).toBeVisible({ timeout: 8000 });

  // Named version, then change, then restore
  await page.getByRole('button', { name: 'Save Version' }).click();
  await page.getByLabel('Version name').fill('First draft');
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  await expect(page.getByText('Version saved.')).toBeVisible();
  await page.getByLabel('Full name').fill('Changed Name');
  await expect(page.getByText('Unsaved changes…')).toBeVisible();
  await expect(page.getByText('All changes saved')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Version History' }).click();
  await page.getByRole('button', { name: 'Restore' }).first().click();
  await expect(page.getByText(/Restored/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jordan Fox', level: 1 })).toBeVisible();

  // ATS Checker & Files/Code mode
  await page.getByRole('button', { name: 'ATS Checker' }).click();
  await expect(page.getByText(/ATS Readiness Score:/)).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.getByRole('button', { name: /Files & Code/ }).click();
  await expect(page.getByLabel('cv.json code editor')).toBeVisible();
  await page.getByRole('button', { name: /Guided & Visual/ }).click();

  // Persistence after refresh
  await page.goto(editorUrl);
  await expect(page.getByLabel('Full name')).toHaveValue('Jordan Fox');

  // Appears in Your Projects and opens in the editor
  await page.getByRole('link', { name: 'Your Projects' }).click();
  await page.getByRole('link', { name: 'Continue Editing' }).first().click();
  await expect(page).toHaveURL(editorUrl);

  // No horizontal overflow on a phone
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
