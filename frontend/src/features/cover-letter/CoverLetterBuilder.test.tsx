import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardPage } from '../dashboard/DashboardPage';

const emptyPage = { count: 0, results: [], next: null, previous: null };
afterEach(() => vi.unstubAllGlobals());

it('renders the Cover Letter Builder Index page with Created Cover Letters Table, Search Bar, Filters, and Create New Cover Letter button', async () => {
  const letters = [
    {
      id: 'cl-1',
      title: 'Platform Engineer Cover Letter',
      kind: 'cover_letter',
      favorite: true,
      archived: false,
      folder: null,
      folder_name: null,
      updated_at: '2026-11-20T10:00:00Z',
      deleted_at: null,
    },
  ];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path.includes('/dashboard/summary/')) {
        return new Response(
          JSON.stringify({
            counts: { total: 1, advanced_cv: 0, cover_letter: 1, deleted: 0 },
            profile: { sections: [], completed: 1, total: 7, percent: 14 },
            workflows: { advanced_cv: true, cover_letter: true, profile: false },
          })
        );
      }
      if (path.includes('/project-folders/')) return new Response(JSON.stringify([]));
      if (path.includes('/projects/?')) {
        return new Response(JSON.stringify({ count: 1, results: letters, next: null, previous: null }));
      }
      return new Response(JSON.stringify(emptyPage));
    })
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard/cover-letters']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  expect(await screen.findByRole('heading', { name: 'Cover Letter Builder' })).toBeVisible();
  expect(screen.getByLabelText('Search Cover Letters by project name')).toBeVisible();
  expect(screen.getByLabelText('Filter Cover Letters by folder')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Create New Cover Letter' })).toBeVisible();
  expect(await screen.findByRole('table', { name: 'Created Cover Letters' })).toBeVisible();
  expect(screen.getByText('Platform Engineer Cover Letter')).toBeVisible();
});

it('creates a new blank Cover Letter with default name Untitled, empty workspace, Monaco code editor, live A4 preview, save, and cover letter analysis tools', async () => {
  let storedTitle = 'Untitled';
  let storedContent: { files?: Record<string, string>; folders?: string[] } = {};
  const putPayloads: any[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
      if (path === '/api/projects/' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        storedTitle = body.title;
        return new Response(
          JSON.stringify({
            id: 'new-cl-uuid',
            title: storedTitle,
            kind: 'cover_letter',
            favorite: false,
            archived: false,
            folder: null,
            folder_name: null,
            updated_at: '2026-11-20T10:05:00Z',
            deleted_at: null,
          }),
          { status: 201 }
        );
      }
      if (path.endsWith('/projects/new-cl-uuid/document/') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'new-cl-uuid',
              title: storedTitle,
              kind: 'cover_letter',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-20T10:05:00Z',
              deleted_at: null,
            },
            content: storedContent,
            design: {},
            revision: 1,
          })
        );
      }
      if (path.endsWith('/projects/new-cl-uuid/document/') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        putPayloads.push(body);
        storedTitle = body.title || storedTitle;
        storedContent = body.content || storedContent;
        return new Response(
          JSON.stringify({
            project: {
              id: 'new-cl-uuid',
              title: storedTitle,
              kind: 'cover_letter',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-20T10:10:00Z',
              deleted_at: null,
            },
            content: storedContent,
            design: {},
            revision: 2,
          })
        );
      }
      if (path.includes('/projects/?')) {
        return new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                id: 'new-cl-uuid',
                title: storedTitle,
                kind: 'cover_letter',
                favorite: false,
                archived: false,
                folder: null,
                folder_name: null,
                updated_at: '2026-11-20T10:10:00Z',
                deleted_at: null,
              },
            ],
            next: null,
            previous: null,
          })
        );
      }
      if (path.includes('/project-folders/')) return new Response(JSON.stringify([]));
      return new Response(JSON.stringify(emptyPage));
    })
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard/cover-letters']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  await userEvent.click(await screen.findByRole('button', { name: 'Create New Cover Letter' }));

  const titleInput = await screen.findByLabelText('Project name');
  expect(titleInput).toHaveValue('Untitled');
  expect(screen.getByText('No files or folders yet.')).toBeVisible();
  expect(screen.getByText('Empty React Cover Letter Workspace')).toBeVisible();

  // Analysis tools disabled before saving
  expect(screen.getByRole('button', { name: 'ATS Checker' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Job Matcher' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Grammar Checker' })).toBeDisabled();

  // Create a React JSX cover letter file
  await userEvent.click(screen.getByRole('button', { name: 'Create First File' }));
  await userEvent.type(screen.getByPlaceholderText('main.jsx'), 'letter.jsx');
  await userEvent.click(screen.getByRole('button', { name: 'Create File' }));

  const codeEditor = await screen.findByLabelText('Code editor for letter.jsx');
  fireEvent.change(codeEditor, {
    target: {
      value:
        'export default function CoverLetter() { return <article><header><h1>Alex Rivera</h1><p>alex@example.com | +1 555-234-5678</p></header><p>Dear Hiring Manager,</p><p>I am applying for the Staff Backend Engineer position and bring 5 years of Python and Django experience.</p><p>Sincerely, Alex Rivera</p></article>; }',
    },
  });

  // Rename and save via Ctrl+S
  fireEvent.change(titleInput, { target: { value: 'Staff Backend Cover Letter' } });
  fireEvent.keyDown(window, { key: 's', ctrlKey: true });

  await waitFor(() => expect(putPayloads.length).toBeGreaterThanOrEqual(1));
  expect(await screen.findByText('All Changes Saved')).toBeVisible();

  // Verify Cover Letter analysis tools are enabled after saving and open ATS Checker
  const atsBtn = screen.getByRole('button', { name: 'ATS Checker' });
  expect(atsBtn).toBeEnabled();
  await userEvent.click(atsBtn);
  expect(await screen.findByText('Cover Letter Components (Salutation, Body & Sign-Off)')).toBeVisible();

  // Navigate back to Created Cover Letters table and verify the updated project name appears
  await userEvent.click(screen.getByRole('link', { name: /Back to Cover Letters/i }));
  expect(await screen.findByText('Staff Backend Cover Letter')).toBeVisible();
});

