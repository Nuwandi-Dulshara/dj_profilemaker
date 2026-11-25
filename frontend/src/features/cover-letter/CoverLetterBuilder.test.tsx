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
}, 15000);

it('imports from Career Profile and from an existing CV into editable cover letter files', async () => {
  let storedContent: { files?: Record<string, string>; folders?: string[] } = {
    files: {
      'letter.jsx': 'export default function CoverLetter() { return <article><p>Dear Hiring Manager,</p></article>; }',
    },
    folders: [],
  };
  let storedDesign: Record<string, any> = {};

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
      if (path.includes('/career-profile/')) {
        return new Response(
          JSON.stringify({
            personal: {
              first_name: 'Nuwandi',
              last_name: 'Dulshara',
              email: 'nuwandi@example.com',
              phone: '+94 71 700 1650',
              location: 'Sri Lanka',
              professional_title: 'Software Engineer',
              bio: '',
              linkedin: '',
              github: '',
              portfolio: '',
            },
            summary: 'Full-Stack Engineer with React and Django.',
            experience: [],
            education: [],
            skills: ['React', 'Django'],
            projects: [],
            certifications: [],
            revision: 1,
            updated_at: '2026-11-22T10:00:00Z',
            percent: 43,
            sections: [],
          })
        );
      }
      if (path.includes('/projects/?kind=advanced_cv')) {
        return new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                id: 'cv-source-1',
                title: 'Backend CV',
                kind: 'advanced_cv',
                favorite: false,
                archived: false,
                folder: null,
                folder_name: null,
                updated_at: '2026-11-22T09:00:00Z',
                deleted_at: null,
              },
            ],
            next: null,
            previous: null,
          })
        );
      }
      if (path.endsWith('/projects/cv-source-1/document/')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'cv-source-1',
              title: 'Backend CV',
              kind: 'advanced_cv',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-22T09:00:00Z',
              deleted_at: null,
            },
            content: {
              files: {
                'App.jsx':
                  'export default function CV() { return <article><h1>Nuwandi Dulshara</h1><p>nuwandi@example.com | +94 71 700 1650</p><section><h2>SKILLS</h2><p>Python, FastAPI, PostgreSQL</p></section></article>; }',
              },
              folders: [],
            },
            design: {},
            revision: 1,
          })
        );
      }
      if (path.endsWith('/projects/cl-import-1/document/') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'cl-import-1',
              title: 'Target Cover Letter',
              kind: 'cover_letter',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-22T10:00:00Z',
              deleted_at: null,
            },
            content: storedContent,
            design: storedDesign,
            revision: 1,
          })
        );
      }
      if (path.endsWith('/projects/cl-import-1/document/') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        storedContent = body.content || storedContent;
        storedDesign = body.design || storedDesign;
        return new Response(
          JSON.stringify({
            project: {
              id: 'cl-import-1',
              title: body.title || 'Target Cover Letter',
              kind: 'cover_letter',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-22T10:05:00Z',
              deleted_at: null,
            },
            content: storedContent,
            design: storedDesign,
            revision: 2,
          })
        );
      }
      return new Response(JSON.stringify(emptyPage));
    })
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard/cover-letters/cl-import-1']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  await userEvent.click(await screen.findByRole('button', { name: 'Import from Career Profile / CV' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Import selected sections' }));

  const profileJsonEditor = await screen.findByLabelText('Code editor for career-profile.json');
  expect((profileJsonEditor as HTMLTextAreaElement).value).toContain('Full-Stack Engineer with React and Django.');

  // Now also import from an existing CV
  await userEvent.click(screen.getByRole('button', { name: 'Import from Career Profile / CV' }));
  await userEvent.click(screen.getByRole('tab', { name: 'An existing CV' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Import from CV' }));

  const cvJsonEditor = await screen.findByLabelText('Code editor for cv-import.json');
  expect((cvJsonEditor as HTMLTextAreaElement).value).toContain('Nuwandi Dulshara');
  expect((cvJsonEditor as HTMLTextAreaElement).value).toContain('Python');
}, 15000);

it('manages Company Details panel, auto-fills into cover letter, allows editing, and saves with the project', async () => {
  const putPayloads: any[] = [];
  let storedContent: { files?: Record<string, string>; folders?: string[] } = {
    files: {
      'letter.jsx':
        'export default function CoverLetter() { return <article><header><h1>Nuwandi Dulshara</h1></header><p>Dear Hiring Manager,</p><p>I am excited to apply.</p></article>; }',
    },
    folders: [],
  };
  let storedDesign: Record<string, any> = {};

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
      if (path.includes('/career-profile/')) {
        return new Response(
          JSON.stringify({
            personal: {},
            summary: '',
            experience: [],
            education: [],
            skills: [],
            projects: [],
            certifications: [],
            revision: 1,
            updated_at: null,
            percent: 0,
            sections: [],
          })
        );
      }
      if (path.endsWith('/projects/cl-company-1/document/') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'cl-company-1',
              title: 'Company Targeted Letter',
              kind: 'cover_letter',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-22T10:00:00Z',
              deleted_at: null,
            },
            content: storedContent,
            design: storedDesign,
            revision: 1,
          })
        );
      }
      if (path.endsWith('/projects/cl-company-1/document/') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        putPayloads.push(body);
        storedContent = body.content || storedContent;
        storedDesign = body.design || storedDesign;
        return new Response(
          JSON.stringify({
            project: {
              id: 'cl-company-1',
              title: body.title || 'Company Targeted Letter',
              kind: 'cover_letter',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-22T10:05:00Z',
              deleted_at: null,
            },
            content: storedContent,
            design: storedDesign,
            revision: 2,
          })
        );
      }
      return new Response(JSON.stringify(emptyPage));
    })
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard/cover-letters/cl-company-1']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  const toggleBtn = await screen.findByRole('button', { name: 'Company Details' });
  await userEvent.click(toggleBtn);

  const panel = await screen.findByRole('region', { name: 'Company Details Panel' });
  expect(panel).toBeVisible();

  await userEvent.type(screen.getByLabelText('Company Name'), 'Acme Corp');
  await userEvent.type(screen.getByLabelText('Job Title'), 'Staff Engineer');
  await userEvent.type(screen.getByLabelText('Hiring Manager (optional)'), 'Jane Doe');
  await userEvent.type(screen.getByLabelText('Company Address (optional)'), '123 Innovation Way');
  await userEvent.type(screen.getByLabelText('Job Description'), 'Looking for React and TypeScript expertise.');

  await userEvent.click(screen.getByRole('button', { name: 'Auto-Fill Cover Letter' }));

  const letterEditor = (await screen.findByLabelText('Code editor for letter.jsx')) as HTMLTextAreaElement;
  expect(letterEditor.value).toContain('Acme Corp');
  expect(letterEditor.value).toContain('Staff Engineer');
  expect(letterEditor.value).toContain('Jane Doe');
  expect(letterEditor.value).toContain('123 Innovation Way');
  expect(letterEditor.value).toContain('Dear Jane Doe,');
  expect(screen.getByText('company-details.json')).toBeVisible();

  // Edit company name and re-apply Auto-Fill
  const companyInput = screen.getByLabelText('Company Name');
  await userEvent.clear(companyInput);
  await userEvent.type(companyInput, 'Beta Labs');
  await userEvent.click(screen.getByRole('button', { name: 'Auto-Fill Cover Letter' }));
  expect(letterEditor.value).toContain('Beta Labs');
  expect(letterEditor.value).not.toContain('Acme Corp');

  // Save details with the cover letter project
  await userEvent.click(screen.getByRole('button', { name: 'Save Details' }));
  await waitFor(() => expect(putPayloads).toHaveLength(1));
  expect(putPayloads[0].design.companyDetails).toEqual({
    companyName: 'Beta Labs',
    jobTitle: 'Staff Engineer',
    hiringManager: 'Jane Doe',
    companyAddress: '123 Innovation Way',
    jobDescription: 'Looking for React and TypeScript expertise.',
  });
}, 15000);

it('shows a real-time one-page A4 warning when cover letter content exceeds one page and clears it when shortened', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path.includes('/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
      if (path.includes('/career-profile/')) {
        return new Response(
          JSON.stringify({
            personal: {},
            summary: '',
            experience: [],
            education: [],
            skills: [],
            projects: [],
            certifications: [],
            revision: 1,
            updated_at: null,
            percent: 0,
            sections: [],
          })
        );
      }
      if (path.endsWith('/projects/cl-limit-1/document/')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'cl-limit-1',
              title: 'Two Page Letter',
              kind: 'cover_letter',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-25T09:00:00Z',
              deleted_at: null,
            },
            content: {
              files: {
                'letter.jsx':
                  'export default function CoverLetter() { return <main><article className="cv-page"><p>Page 1</p></article><article className="cv-page"><p>Page 2</p></article></main>; }',
              },
              folders: [],
            },
            design: {},
            revision: 1,
          })
        );
      }
      return new Response(JSON.stringify(emptyPage));
    })
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard/cover-letters/cl-limit-1']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  const warning = await screen.findByRole('alert', { name: 'One-page A4 limit warning' });
  expect(warning).toBeVisible();
  expect(warning).toHaveTextContent('Exceeds 1 A4 page');
  expect(warning).toHaveTextContent('2 pages');

  const editor = screen.getByLabelText('Code editor for letter.jsx');
  fireEvent.change(editor, {
    target: {
      value:
        'export default function CoverLetter() { return <article className="cv-page"><p>Concise one-page letter</p></article>; }',
    },
  });

  await waitFor(() => {
    expect(screen.queryByRole('alert', { name: 'One-page A4 limit warning' })).toBeNull();
  });
}, 15000);

