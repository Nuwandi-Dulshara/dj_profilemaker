import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveMetricsBar } from './LiveMetricsBar';
import { WritingAssistantDialog } from './WritingAssistantDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { ShareLinkDialog } from './ShareLinkDialog';
import { ExportHistoryDialog } from './ExportHistoryDialog';
import { StarterKitsDialog } from './StarterKitsDialog';
import { PublicSharePage } from './PublicSharePage';

afterEach(() => vi.unstubAllGlobals());

it('renders LiveMetricsBar with word count, A4 page count, reading time, and page limit warning', () => {
  render(
    <LiveMetricsBar
      html="<article><h1>Jane Doe</h1><p>Full stack software engineer building scalable web apps.</p></article>"
      pageCount={3}
      recommendedMaxPages={2}
      documentLabel="CV"
    />
  );

  const bar = screen.getByRole('status', { name: 'CV Live Metrics' });
  expect(bar).toHaveTextContent('10 words');
  expect(bar).toHaveTextContent('3 A4 pages');
  expect(bar).toHaveTextContent('~1 min read');
  expect(screen.getByRole('alert')).toHaveTextContent('Exceeds recommended 2-page CV limit (3 pages)');
});

it('improves selected writing and suggests missing Career Profile skills without inventing fake ones', async () => {
  const onApply = vi.fn();

  render(
    <WritingAssistantDialog
      selectedText="responsible for javascript backend and worked on postgresql"
      renderedHtml="<article><p>React</p></article>"
      careerProfile={{
        personal: {
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          phone: '',
          location: '',
          professional_title: 'Engineer',
          bio: '',
          linkedin: '',
          github: '',
          portfolio: '',
        },
        summary: '',
        experience: [],
        education: [],
        skills: ['React', 'PostgreSQL', 'Docker'],
        projects: [],
        certifications: [],
        revision: 1,
        updated_at: null,
        percent: 40,
        sections: [],
      }}
      onApplySelection={onApply}
      onClose={vi.fn()}
    />
  );

  const output = screen.getByLabelText('Improved Text Suggestion');
  expect(output).toHaveTextContent('Led JavaScript backend and Engineered PostgreSQL');
  expect(screen.getByText('PostgreSQL')).toBeVisible();
  expect(screen.getByText('Docker')).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: 'Replace Selection in Editor' }));
  expect(onApply).toHaveBeenCalledWith('Led JavaScript backend and Engineered PostgreSQL');
});

it('lists Version History snapshots and restores an earlier revision', async () => {
  const onRestored = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
      if (path.endsWith('/snapshots/')) {
        return new Response(
          JSON.stringify({
            snapshots: [
              { id: 's-2', revision: 2, title: 'CV v2', content: { files: { 'App.jsx': 'v2' } }, design: {}, created_at: '2026-11-25T09:00:00Z' },
              { id: 's-1', revision: 1, title: 'CV v1', content: { files: { 'App.jsx': 'v1' } }, design: {}, created_at: '2026-11-25T08:00:00Z' },
            ],
          })
        );
      }
      if (path.endsWith('/snapshots/s-1/restore/') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            project: { title: 'CV v1' },
            content: { files: { 'App.jsx': 'v1' } },
            design: {},
            restored_from_revision: 1,
          })
        );
      }
      return new Response('{}');
    })
  );

  render(<VersionHistoryDialog projectId="p-1" onRestored={onRestored} onClose={vi.fn()} />);

  expect(await screen.findByText(/Revision #1 — CV v1/)).toBeVisible();
  const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
  await userEvent.click(restoreButtons[1]);

  await waitFor(() => expect(onRestored).toHaveBeenCalledWith(expect.objectContaining({ title: 'CV v1', restoredFromRevision: 1 })));
});

it('generates and revokes a Public Share Link and renders read-only PublicSharePage', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
      if (path.endsWith('/projects/p-1/share/') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ share: null }));
      }
      if (path.endsWith('/projects/p-1/share/') && init?.method === 'POST') {
        return new Response(JSON.stringify({ share: { token: 'abc123token', is_active: true, created_at: '2026-11-25T09:00:00Z' } }), { status: 201 });
      }
      if (path.endsWith('/projects/p-1/share/') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ share: null }));
      }
      if (path.endsWith('/public/share/abc123token/')) {
        return new Response(
          JSON.stringify({
            title: 'Recruiter Ready CV',
            kind: 'advanced_cv',
            updated_at: '2026-11-25T09:00:00Z',
            content: { files: { 'App.jsx': 'export default function CV() { return <h1>Nuwandi Dulshara</h1>; }' } },
            design: {},
          })
        );
      }
      return new Response('{}');
    })
  );

  const { unmount } = render(<ShareLinkDialog projectId="p-1" projectTitle="Recruiter Ready CV" onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Generate Public Share Link' }));
  const urlInput = (await screen.findByLabelText('Public Share URL')) as HTMLInputElement;
  expect(urlInput.value).toContain('/share/abc123token');

  await userEvent.click(screen.getByRole('button', { name: 'Revoke Link' }));
  expect(await screen.findByRole('button', { name: 'Generate Public Share Link' })).toBeVisible();
  unmount();

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/share/abc123token']}>
        <Routes>
          <Route path="/share/:token" element={<PublicSharePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  expect(await screen.findByRole('heading', { name: 'Recruiter Ready CV' })).toBeVisible();
  expect(screen.getByText('Nuwandi Dulshara')).toBeVisible();
});

it('displays ExportHistoryDialog counts and events and lets users pick a Starter Kit', async () => {
  const onSelectKit = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          pdf_count: 3,
          docx_count: 1,
          total_count: 4,
          events: [{ id: 'e-1', format: 'pdf', created_at: '2026-11-25T09:00:00Z' }],
        })
      )
    )
  );

  const { unmount } = render(<ExportHistoryDialog projectId="p-1" onClose={vi.fn()} />);
  const counts = await screen.findByLabelText('Export Counts');
  expect(counts).toHaveTextContent('4Total Exports');
  expect(counts).toHaveTextContent('3PDF Downloads');
  expect(counts).toHaveTextContent('1DOCX Downloads');
  unmount();

  render(<StarterKitsDialog kind="advanced_cv" creating={false} onSelectKit={onSelectKit} onClose={vi.fn()} />);
  const useButtons = screen.getAllByRole('button', { name: 'Use Starter Kit' });
  await userEvent.click(useButtons[0]);
  expect(onSelectKit).toHaveBeenCalledWith(expect.objectContaining({ id: 'cv-modular', folders: ['components'] }));
});

