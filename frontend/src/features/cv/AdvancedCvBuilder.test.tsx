import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardPage } from '../dashboard/DashboardPage';

const emptyPage = { count: 0, results: [], next: null, previous: null };
afterEach(() => vi.unstubAllGlobals());

it('renders the Advanced CV Builder Index page with Created CVs Table, Search Bar, Filters, and Create New CV button', async () => {
  const cvs = [
    {
      id: 'cv-1',
      title: 'Frontend React CV',
      kind: 'advanced_cv',
      favorite: true,
      archived: false,
      folder: null,
      folder_name: null,
      updated_at: '2026-11-20T08:00:00Z',
      deleted_at: null,
    },
  ];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path.includes('/dashboard/summary/')) {
        return new Response(
          JSON.stringify({
            counts: { total: 1, advanced_cv: 1, cover_letter: 0, deleted: 0 },
            profile: { sections: [], completed: 1, total: 7, percent: 14 },
            workflows: { advanced_cv: true, cover_letter: false, profile: false },
          })
        );
      }
      if (path.includes('/project-folders/')) return new Response(JSON.stringify([]));
      if (path.includes('/projects/?')) {
        return new Response(JSON.stringify({ count: 1, results: cvs, next: null, previous: null }));
      }
      return new Response(JSON.stringify(emptyPage));
    })
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard/advanced-cv']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  expect(await screen.findByRole('heading', { name: 'Advanced CV Builder' })).toBeVisible();
  expect(screen.getByLabelText('Search CVs by project name')).toBeVisible();
  expect(screen.getByLabelText('Filter CVs by folder')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Create New CV' })).toBeVisible();
  expect(await screen.findByRole('table', { name: 'Created CVs' })).toBeVisible();
  expect(screen.getByText('Frontend React CV')).toBeVisible();
});

it('creates a new blank CV with default name Untitled, completely empty workspace, and saves renamed project', async () => {
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
            id: 'new-cv-uuid',
            title: storedTitle,
            kind: 'advanced_cv',
            favorite: false,
            archived: false,
            folder: null,
            folder_name: null,
            updated_at: '2026-11-20T09:00:00Z',
            deleted_at: null,
          }),
          { status: 201 }
        );
      }
      if (path.endsWith('/projects/new-cv-uuid/document/') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'new-cv-uuid',
              title: storedTitle,
              kind: 'advanced_cv',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-20T09:00:00Z',
              deleted_at: null,
            },
            content: storedContent,
            design: {},
            revision: 1,
          })
        );
      }
      if (path.endsWith('/projects/new-cv-uuid/document/') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        putPayloads.push(body);
        storedTitle = body.title || storedTitle;
        storedContent = body.content || storedContent;
        return new Response(
          JSON.stringify({
            project: {
              id: 'new-cv-uuid',
              title: storedTitle,
              kind: 'advanced_cv',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-20T09:05:00Z',
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
                id: 'new-cv-uuid',
                title: storedTitle,
                kind: 'advanced_cv',
                favorite: false,
                archived: false,
                folder: null,
                folder_name: null,
                updated_at: '2026-11-20T09:05:00Z',
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
      <MemoryRouter initialEntries={['/dashboard/advanced-cv']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  // Click Create New CV from the index page
  await userEvent.click(await screen.findByRole('button', { name: 'Create New CV' }));

  // Verify default project name is "Untitled" and workspace is initially completely empty
  const titleInput = await screen.findByLabelText('Project name');
  expect(titleInput).toHaveValue('Untitled');
  expect(screen.getByText('No files or folders yet.')).toBeVisible();
  expect(screen.getByText('Empty React CV Workspace')).toBeVisible();

  // Verify analysis tools are disabled before CV is saved with rendered content
  expect(screen.getByRole('button', { name: 'ATS Checker' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Job Matcher' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Grammar Checker' })).toBeDisabled();

  // Manually create a React JSX file
  await userEvent.click(screen.getByRole('button', { name: 'Create First File' }));
  await userEvent.type(screen.getByPlaceholderText('main.jsx'), 'App.jsx');
  await userEvent.click(screen.getByRole('button', { name: 'Create File' }));

  const codeEditor = await screen.findByLabelText('Code editor for App.jsx');
  fireEvent.change(codeEditor, { target: { value: 'export default function App() { return <h1>My CV</h1>; }' } });
  expect(screen.getByText('Unsaved Changes')).toBeVisible();

  // Rename project directly in workspace and press Ctrl+S (or click Save)
  fireEvent.change(titleInput, { target: { value: 'Senior React Developer CV' } });
  fireEvent.keyDown(window, { key: 's', ctrlKey: true });

  await waitFor(() => expect(putPayloads.length).toBeGreaterThanOrEqual(1));
  const latestPut = putPayloads[putPayloads.length - 1];
  expect(latestPut.title).toBe('Senior React Developer CV');
  expect(latestPut.content.files['App.jsx']).toContain('export default function App()');
  expect(await screen.findByText('All Changes Saved')).toBeVisible();

  // Verify analysis tools are now enabled after saving without requiring download
  expect(screen.getByRole('button', { name: 'ATS Checker' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Job Matcher' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Grammar Checker' })).toBeEnabled();

  // Verify Ribbon Menu tabs (File, View, Contacts / Help) and view mode switching
  await userEvent.click(screen.getByRole('tab', { name: 'View' }));
  expect(screen.getByRole('button', { name: 'Split View' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Editor Only' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Preview Only' })).toBeVisible();
  expect(screen.getAllByRole('button', { name: 'Open PDF in New Tab' }).length).toBeGreaterThanOrEqual(1);

  await userEvent.click(screen.getByRole('tab', { name: 'Contacts / Help' }));
  expect(screen.getByRole('button', { name: 'Contact Support' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Help' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Documentation' })).toBeVisible();

  // Open Documentation modal and verify instructions
  await userEvent.click(screen.getByRole('button', { name: 'Documentation' }));
  expect(await screen.findByRole('heading', { name: 'Advanced CV Builder Documentation' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

  // Navigate back to Created CVs table and verify the updated project name appears
  await userEvent.click(screen.getByRole('link', { name: /Back to CVs/i }));
  expect(await screen.findByText('Senior React Developer CV')).toBeVisible();
}, 15000);

it('supports multi-file React imports, nested folders, file duplicate/rename, multi-page A4 preview, error detection, and DOCX export', async () => {
  const { compileAndRenderCvWorkspace, exportRenderedCvToDocx } = await import('./cvRuntime');

  // 1. Verify multi-file React JSX compilation with imports, props, CSS, and multi-page A4 breaks
  const compiled = compileAndRenderCvWorkspace({
    'components/Header.jsx':
      'export default function Header({ name, role }) { return <header className="cv-head"><h1>{name}</h1><p>{role}</p></header>; }',
    'main.jsx':
      'import Header from "./components/Header.jsx";\nimport "./styles.css";\nexport default function MainCV() {\n  return (\n    <div className="cv-doc">\n      <Header name="Alex Rivera" role="Principal Engineer" />\n      <section><h2>Page One Experience</h2></section>\n      <div className="page-break" />\n      <section><h2>Page Two Publications</h2></section>\n    </div>\n  );\n}',
    'styles.css': '.cv-head { border-bottom: 2px solid #0b1f3a; }',
  });

  expect(compiled.runtimeError).toBeNull();
  expect(compiled.diagnostics).toHaveLength(0);
  expect(compiled.html).toContain('Alex Rivera');
  expect(compiled.html).toContain('Principal Engineer');
  expect(compiled.pages).toHaveLength(2);
  expect(compiled.pages[0]).toContain('Page One Experience');
  expect(compiled.pages[1]).toContain('Page Two Publications');
  expect(compiled.css).toContain('.cv-head');

  // 2. Verify error detection for unresolved imports and unbalanced braces
  const broken = compileAndRenderCvWorkspace({
    'main.jsx': 'import Missing from "./Missing.jsx";\nexport default function Broken() { return (<div><h1>Unclosed</div>; }',
  });
  expect(broken.diagnostics.length).toBeGreaterThanOrEqual(2);
  expect(broken.diagnostics.some((d) => d.message.includes('Cannot resolve import "./Missing.jsx"'))).toBe(true);
  expect(broken.diagnostics.some((d) => d.message.includes('Unexpected closing "}"'))).toBe(true);

  // 3. Verify DOCX export generates an editable Word binary blob from rendered HTML (not raw JSX)
  const docxBlob = await exportRenderedCvToDocx(compiled.html, 'Alex Rivera CV');
  expect(docxBlob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  expect(docxBlob.size).toBeGreaterThan(500);

  // 4. Verify 2-page .cv-page layout produces exactly 2 pages and filters out any empty trailing pages
  const twoPageCv = compileAndRenderCvWorkspace({
    'NuwandiCV.jsx': `
      export default function NuwandiCV() {
        return (
          <main className="cv-document">
            <article className="cv-page cv-page-one"><h1>Page 1 Content</h1></article>
            <article className="cv-page cv-page-two"><h2>Page 2 Content</h2></article>
            <article className="cv-page"></article>
          </main>
        );
      }
    `,
  });
  expect(twoPageCv.pages).toHaveLength(2);
  expect(twoPageCv.pages[0]).toContain('Page 1 Content');
  expect(twoPageCv.pages[1]).toContain('Page 2 Content');
});

it('enables ATS Checker, Job Matcher, and Grammar Checker after saving the CV and analyzes the saved rendered CV', async () => {
  const { runAtsCheck, runJobMatchAnalysis, runGrammarCheck } = await import('./cvAnalysis');
  const { compileAndRenderCvWorkspace } = await import('./cvRuntime');

  // Compile a React JSX CV to rendered HTML & CSS
  const savedCv = compileAndRenderCvWorkspace({
    'main.jsx': `
      export default function CandidateCV() {
        return (
          <div className="cv-root">
            <header>
              <h1>Jordan Taylor</h1>
              <p>Software Engineer | jordan@example.com</p>
            </header>
            <section>
              <h2>Education</h2>
              <p>BICT (Honours), final results pending</p>
            </section>
            <section>
              <h2>Work Experience</h2>
              <p>2 years of software engineering experiance building web services and REST API integration.</p>
              <ul>
                <li>I worked on application testing and debugging for various things etc.</li>
                <li>Helped with the the deployment pipeline using Git, GitHub, Bitbucket, and CI/CD.</li>
              </ul>
            </section>
            <section>
              <h2>Skills</h2>
              <p>Java, javascript, Git, GitHub, Bitbucket, CI/CD</p>
            </section>
          </div>
        );
      }
    `,
    'styles.css': '.cv-root { display: grid; grid-template-columns: 1fr 2fr; }',
  });

  // ATS Checker verification on saved rendered CV
  const ats = runAtsCheck(savedCv.html, savedCv.css);
  expect(ats.items).toHaveLength(8);
  expect(ats.contactInfo.email).toBe(true);
  expect(ats.contactInfo.phone).toBe(false); // Missing phone detected
  expect(ats.items.some((i) => i.id === 'contact-information' && i.status !== 'Pass')).toBe(true);
  expect(ats.items.some((i) => i.id === 'tables-multicolumn' && i.status === 'Warning')).toBe(true);
  expect(ats.disclaimer).toContain('does not guarantee acceptance');

  // Job Matcher verification (including strict technology distinction: REST API != REST Assured)
  const jobDesc = [
    "Bachelor's degree in Computing or related field",
    '3+ years in SDET or test automation',
    'Strong Java and OOP',
    'Selenium and Appium',
    'REST Assured',
    'REST Assured', // duplicate requirement to test duplicate detection
    'CI/CD, GitLab, Jenkins, and GCP',
  ].join('\n');

  const matchRes = runJobMatchAnalysis(savedCv.html, jobDesc);
  expect(matchRes.duplicateCount).toBe(1);
  expect(matchRes.comparisons).toHaveLength(6);

  const restAssuredRow = matchRes.comparisons.find((c) => c.requirement === 'REST Assured');
  expect(restAssuredRow?.status).toBe('Missing');
  expect(restAssuredRow?.cvInformation).toContain('REST API integration mentioned, but not REST Assured');
  expect(restAssuredRow?.duplicateCount).toBe(2);

  const cicdRow = matchRes.comparisons.find((c) => c.requirement.includes('CI/CD, GitLab'));
  expect(cicdRow?.status).toBe('Partial Match');
  expect(matchRes.missingKeywords).toEqual(
    expect.arrayContaining(['REST Assured', 'Selenium', 'Appium', 'GitLab', 'Jenkins', 'GCP'])
  );

  // Grammar Checker verification on saved rendered CV text (does not touch React code)
  const grammar = runGrammarCheck(savedCv.html);
  expect(grammar.totalIssues).toBeGreaterThanOrEqual(5);
  const issueTypes = grammar.issues.map((i) => i.issueType);
  expect(issueTypes).toContain('Spelling Mistake'); // "experiance" -> "experience"
  expect(issueTypes).toContain('Repeated Words'); // "the the" -> "the"
  expect(issueTypes).toContain('Weak Action Verb'); // "worked on" / "Helped with"
  expect(issueTypes).toContain('Unclear Description'); // "various things" / "etc."
  expect(issueTypes).toContain('Unprofessional Wording'); // "I worked"
  expect(issueTypes).toContain('Capitalization & Punctuation'); // "javascript" -> "JavaScript"
});

it('imports Career Profile into an editable copy, keeps edits isolated, and refreshes when Career Profile updates', async () => {
  const careerPutCalls: string[] = [];
  let careerRevision = 1;
  let careerSummary = 'Initial profile summary.';
  let storedContent: { files?: Record<string, string>; folders?: string[] } = {
    files: {
      'App.jsx': 'export default function CV() { return <article><h1>CV</h1></article>; }',
    },
    folders: [],
  };
  let storedDesign: Record<string, any> = {};

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
      if (path.includes('/career-profile/')) {
        if (init?.method === 'PUT') careerPutCalls.push(path);
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
            summary: careerSummary,
            experience: [{ company: 'Novagen', role: 'Software Engineer', location: 'Remote', start_date: '2025', end_date: '2026', current: false, description: 'Built APIs' }],
            education: [],
            skills: ['React', 'Django'],
            projects: [],
            certifications: [],
            revision: careerRevision,
            updated_at: '2026-11-22T10:00:00Z',
            percent: 57,
            sections: [],
          })
        );
      }
      if (path.endsWith('/projects/cv-import-1/document/') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'cv-import-1',
              title: 'Imported CV',
              kind: 'advanced_cv',
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
      if (path.endsWith('/projects/cv-import-1/document/') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        storedContent = body.content || storedContent;
        storedDesign = body.design || storedDesign;
        return new Response(
          JSON.stringify({
            project: {
              id: 'cv-import-1',
              title: body.title || 'Imported CV',
              kind: 'advanced_cv',
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

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dashboard/advanced-cv/cv-import-1']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  const importBtn = await screen.findByRole('button', { name: 'Import from Career Profile' });
  await userEvent.click(importBtn);

  const applyBtn = await screen.findByRole('button', { name: 'Import selected sections' });
  await userEvent.click(applyBtn);

  const jsonEditor = await screen.findByLabelText('Code editor for career-profile.json');
  expect((jsonEditor as HTMLTextAreaElement).value).toContain('Initial profile summary.');

  // Local edits to career-profile.json do not mutate the Career Profile
  fireEvent.change(jsonEditor, {
    target: { value: (jsonEditor as HTMLTextAreaElement).value.replace('Initial profile summary.', 'CV-only summary edit.') },
  });
  expect(careerPutCalls).toHaveLength(0);

  // Simulate Career Profile update on server and trigger refresh check
  careerRevision = 2;
  careerSummary = 'Updated career profile summary.';
  await client.invalidateQueries({ queryKey: ['workspace', 'career-profile'] });

  const reviewBtn = await screen.findByRole('button', { name: 'Review & refresh' });
  await userEvent.click(reviewBtn);

  expect(await screen.findByText(/Your Career Profile changed since you imported it/)).toBeVisible();
  expect(screen.getByText(/You edited career-profile.json after importing it/)).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'Refresh imported information' }));

  await waitFor(() => {
    const updatedEditor = screen.getByLabelText('Code editor for career-profile.json') as HTMLTextAreaElement;
    expect(updatedEditor.value).toContain('Updated career profile summary.');
  });
  expect(screen.getByText('career-profile.previous.json')).toBeVisible();
  expect(careerPutCalls).toHaveLength(0);
}, 15000);

it('manages Job-Specific CV Versions, creates variants, and compares file differences', async () => {
  const variantPosts: any[] = [];

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
      if (path.endsWith('/projects/cv-base-1/versions/')) {
        return new Response(
          JSON.stringify({
            base_id: 'cv-base-1',
            current_id: 'cv-base-1',
            versions: [
              {
                id: 'cv-base-1',
                title: 'Master CV',
                target_role: '',
                is_base: true,
                is_current: true,
                updated_at: '2026-11-25T08:00:00Z',
                files: { 'App.jsx': 'line1\nline2' },
              },
              {
                id: 'cv-var-1',
                title: 'Master CV — Stripe Backend',
                target_role: 'Stripe Backend',
                is_base: false,
                is_current: false,
                updated_at: '2026-11-25T08:30:00Z',
                files: { 'App.jsx': 'line1\nline2\nStripe highlights' },
              },
            ],
          })
        );
      }
      if (path.endsWith('/projects/cv-base-1/create-variant/') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        variantPosts.push(body);
        return new Response(
          JSON.stringify({
            id: 'cv-var-2',
            title: `Master CV — ${body.target_role}`,
            kind: 'advanced_cv',
            parent_project: 'cv-base-1',
            target_role: body.target_role,
            favorite: false,
            archived: false,
            folder: null,
            folder_name: null,
            updated_at: '2026-11-25T09:00:00Z',
            deleted_at: null,
          }),
          { status: 201 }
        );
      }
      if (path.includes('/projects/cv-base-1/document/') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'cv-base-1',
              title: 'Master CV',
              kind: 'advanced_cv',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-25T08:00:00Z',
              deleted_at: null,
            },
            content: { files: { 'App.jsx': 'line1\nline2' }, folders: [] },
            design: {},
            revision: 1,
          })
        );
      }
      if (path.includes('/projects/cv-base-1/document/') && init?.method === 'PUT') {
        return new Response(
          JSON.stringify({
            project: {
              id: 'cv-base-1',
              title: 'Master CV',
              kind: 'advanced_cv',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-25T09:00:00Z',
              deleted_at: null,
            },
            content: { files: { 'App.jsx': 'line1\nline2' }, folders: [] },
            design: {},
            revision: 2,
          })
        );
      }
      if (path.includes('/projects/cv-var-2/document/')) {
        return new Response(
          JSON.stringify({
            project: {
              id: 'cv-var-2',
              title: 'Master CV — Vercel Frontend',
              kind: 'advanced_cv',
              parent_project: 'cv-base-1',
              target_role: 'Vercel Frontend',
              favorite: false,
              archived: false,
              folder: null,
              folder_name: null,
              updated_at: '2026-11-25T09:00:00Z',
              deleted_at: null,
            },
            content: { files: { 'App.jsx': 'line1\nline2' }, folders: [] },
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
      <MemoryRouter initialEntries={['/dashboard/advanced-cv/cv-base-1']}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  await userEvent.click(await screen.findByRole('button', { name: 'Job Versions' }));

  const versionsList = await screen.findByLabelText('Linked CV Versions');
  expect(versionsList).toHaveTextContent('Master CV — Stripe Backend');

  // Compare Base CV vs Stripe Backend variant
  await userEvent.selectOptions(screen.getByLabelText('Compare target version'), 'cv-var-1');
  expect(await screen.findByText(/\+1 \/ -0 lines/)).toBeVisible();

  // Create a new Job-Specific Version
  await userEvent.type(screen.getByLabelText('Target Job / Company'), 'Vercel Frontend');
  await userEvent.click(screen.getByRole('button', { name: 'Create Job Version' }));

  await waitFor(() => expect(variantPosts).toHaveLength(1));
  expect(variantPosts[0]).toMatchObject({ target_role: 'Vercel Frontend' });
}, 15000);
