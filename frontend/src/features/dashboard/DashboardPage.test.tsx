import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

const empty = { count: 0, results: [], next: null, previous: null };
function mount() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>);
}
afterEach(() => vi.unstubAllGlobals());

it('shows owned API counts and honest empty states, with unavailable editor choices', async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    const data = path.includes('summary') ? { counts: { total: 0, advanced_cv: 0, template_cv: 0, cover_letter: 0, deleted: 0 }, profile: { sections: [], completed: 1, total: 7, percent: 14 }, workflows: {} } : path.includes('storage') ? { used_bytes: 0, quota_bytes: null, scope: 'Stored document data.' } : empty;
    return new Response(JSON.stringify(data));
  }));
  mount();
  expect(await screen.findByText('No projects yet')).toBeVisible();
  expect(await screen.findByText('No recent activity')).toBeVisible();
  expect(await screen.findByText('1 of 7 sections complete')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'New Project' }));
  const dialog = await screen.findByRole('dialog', { name: 'New project' });
  expect(dialog).toHaveTextContent('Document creation is not available yet');
  expect(screen.getByRole('button', { name: /Advanced CV Builder.*Not available yet/i })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('does not turn a failed summary request into zero statistics', async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => new Response(JSON.stringify(path.includes('summary') ? { detail: 'Summary unavailable' } : empty), { status: path.includes('summary') ? 503 : 200 })));
  mount();
  expect(await screen.findByText('Summary unavailable')).toBeVisible();
  expect(screen.queryByLabelText('Total Projects: 0')).not.toBeInTheDocument();
});

it('renders Your Projects with folder management, grid/list switching, filters, and bulk actions', async () => {
  const projects = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Principal Engineer CV',
      kind: 'advanced_cv',
      favorite: false,
      archived: false,
      folder: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      folder_name: 'Engineering Roles',
      updated_at: '2026-11-15T01:00:00Z',
      deleted_at: null,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      title: 'Staff Cover Letter',
      kind: 'cover_letter',
      favorite: true,
      archived: false,
      folder: null,
      folder_name: null,
      updated_at: '2026-11-15T02:00:00Z',
      deleted_at: null,
    },
  ];
  const folders = [
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Engineering Roles', parent: null, parent_name: null, project_count: 1 },
  ];
  const bulkCalls: unknown[] = [];

  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path.includes('/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
    if (path.includes('/auth/me/')) return new Response(JSON.stringify({ user: { id: 1, email: 'alex@example.test', first_name: 'Alex', last_name: 'Morgan' } }));
    if (path.includes('/dashboard/summary/')) {
      return new Response(JSON.stringify({
        counts: { total: 2, advanced_cv: 1, template_cv: 0, cover_letter: 1, deleted: 0 },
        project_stats: { total: 2, active: 2, favorites: 1, archived: 0, advanced_cv: 1, template_cv: 0, cover_letter: 1, deleted: 0 },
        profile: { sections: [{ key: 'personal', label: 'Personal details', complete: true }], completed: 1, total: 7, percent: 14 },
        workflows: {},
      }));
    }
    if (path.includes('/project-folders/')) {
      return new Response(JSON.stringify(folders));
    }
    if (path.includes('/projects/bulk-actions/')) {
      bulkCalls.push(JSON.parse(String(init?.body || '{}')));
      return new Response(JSON.stringify({ action: 'favorite', updated_ids: [projects[0].id, projects[1].id], failed_ids: [], updated_count: 2 }));
    }
    if (path.includes('/projects/')) {
      return new Response(JSON.stringify({
        count: projects.length,
        results: projects,
        next: null,
        previous: null,
        stats: { total: 2, active: 2, favorites: 1, archived: 0, advanced_cv: 1, template_cv: 0, cover_letter: 1, deleted: 0 },
      }));
    }
    if (path.includes('/dashboard/storage/')) {
      return new Response(JSON.stringify({ used_bytes: 2048, quota_bytes: null, scope: 'Stored document data.' }));
    }
    return new Response(JSON.stringify(empty));
  }));

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard/projects']}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

  expect(await screen.findByText('Principal Engineer CV')).toBeVisible();
  expect(screen.getByText('Staff Cover Letter')).toBeVisible();
  expect(screen.getByLabelText('Total Active Projects: 2')).toBeVisible();
  expect(screen.getByLabelText('Favorites: 1')).toBeVisible();

  // Switch between List and Grid view
  await userEvent.click(screen.getByRole('button', { name: 'Grid view' }));
  expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'List view' }));

  // Multi-select all on page and trigger bulk favorite
  await userEvent.click(screen.getByRole('button', { name: 'Select all on page' }));
  expect(await screen.findByText('2 selected')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Add to Favorites' }));
  expect(bulkCalls).toHaveLength(1);
  expect(await screen.findByRole('status')).toHaveTextContent('2 project(s) added to favorites');
});
