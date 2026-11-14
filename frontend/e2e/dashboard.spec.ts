import { test, expect } from '@playwright/test';

test('dashboard and project management workspace operate end-to-end', async ({ page }) => {
  const email = `dash-${Date.now()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('First Name', { exact: true }).fill('Taylor');
  await page.getByLabel('Last Name', { exact: true }).fill('Reed');
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Clear-River!Strange-82');
  await page.getByLabel('Confirm Password', { exact: true }).fill('Clear-River!Strange-82');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: /Welcome back, Taylor/ })).toBeVisible();
  await expect(page.getByLabel('Total Projects: 0')).toBeVisible();

  // Open New Project modal on Dashboard
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New project' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'New project' })).toBeHidden();

  // Create a real project via authenticated API using session + CSRF cookie
  await page.evaluate(async () => {
    const csrfRes = await fetch('/api/auth/csrf/', { credentials: 'same-origin' });
    const { csrfToken } = await csrfRes.json();
    await fetch('/api/projects/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify({ title: 'Senior Backend CV', kind: 'advanced_cv' }),
    });
  });

  // Navigate to Your Projects page
  await page.getByRole('link', { name: 'Your Projects' }).click();
  await expect(page).toHaveURL('/dashboard/projects');
  await expect(page.getByRole('heading', { name: 'Your Projects' })).toBeVisible();
  await expect(page.getByText('Senior Backend CV')).toBeVisible();
  await expect(page.getByLabel('Total Active Projects: 1')).toBeVisible();

  // Create a folder
  await page.getByRole('button', { name: 'New Folder' }).click();
  await page.getByLabel('Folder name').fill('2026 Applications');
  await page.getByRole('button', { name: 'Save folder' }).click();
  await expect(page.getByText('Folder created.')).toBeVisible();
  await expect(page.getByRole('treeitem').filter({ hasText: '2026 Applications' })).toBeVisible();

  // Duplicate project from Actions menu
  await page.getByRole('button', { name: 'Actions for Senior Backend CV' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Senior Backend CV (copy)')).toBeVisible();
  await expect(page.getByLabel('Total Active Projects: 2')).toBeVisible();

  // Soft-delete the duplicate and verify Deleted Files integration
  await page.getByRole('button', { name: 'Actions for Senior Backend CV (copy)' }).click();
  await page.getByRole('button', { name: 'Move to Deleted Files' }).click();
  await page.getByRole('dialog', { name: 'Move to Deleted Files?' }).getByRole('button', { name: 'Move to Deleted Files' }).click();
  await expect(page.getByLabel('Total Active Projects: 1')).toBeVisible();

  await page.getByRole('link', { name: 'Deleted Files' }).click();
  await expect(page).toHaveURL('/dashboard/deleted-files');
  await expect(page.getByText('Senior Backend CV (copy)')).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByText('restored to active projects')).toBeVisible();
});

