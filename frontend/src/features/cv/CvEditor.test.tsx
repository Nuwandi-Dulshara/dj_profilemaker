import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { CvDocument } from '../../document-engine/CvDocument';
import { defaultDesign, emptyContent, normalize } from '../../document-engine/schema';
import { CvEditor } from './CvEditor';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

it('saves the current design as a reusable private template', async () => {
  server();
  mount();
  await screen.findByLabelText('Full name');
  await userEvent.click(screen.getByRole('button', { name: 'Save as Template' }));
  await userEvent.type(screen.getByLabelText('Template name'), 'My navy design');
  await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
  expect(await screen.findByText('Template saved in My Templates.')).toBeVisible();
  const calls = vi.mocked(fetch).mock.calls;
  const call = calls.find(([url, init]) => url === '/api/my-templates/' && init?.method === 'POST');
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ name: 'My navy design', design: { layout: 'single' } });
  expect(JSON.parse(String(call?.[1]?.body))).not.toHaveProperty('content');
});

it('preserves unapplied JSON across modes and saves it when applied', async () => {
  const puts = server();
  mount();
  await screen.findByLabelText('Full name');
  await userEvent.click(screen.getByRole('button', { name: /Files & Code/i }));
  const draft = JSON.stringify({ content: { personal: { name: 'Sam Lee' }, summary: 'Edited JSON' }, design: defaultDesign() });
  fireEvent.change(screen.getByLabelText('cv.json code editor'), { target: { value: draft } });
  expect(screen.getByText('Unapplied JSON changes')).toBeVisible();
  expect(screen.queryByText('All changes saved')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Guided & Visual/i }));
  await userEvent.click(screen.getByRole('button', { name: /Files & Code/i }));
  expect(screen.getByLabelText('cv.json code editor')).toHaveValue(draft);
  await userEvent.click(screen.getByRole('button', { name: 'Apply cv.json changes' }));
  expect(screen.getByText('Edited JSON')).toBeVisible();
  await waitFor(() => expect(puts).toHaveLength(1), { timeout: 5000 });
  expect(puts[0].content.summary).toBe('Edited JSON');
  expect(await screen.findByText('All changes saved')).toBeVisible();
});

it('keeps invalid JSON unsaved and warns before closing the page', async () => {
  const puts = server();
  mount();
  await screen.findByLabelText('Full name');
  await userEvent.click(screen.getByRole('button', { name: /Files & Code/i }));
  fireEvent.change(screen.getByLabelText('cv.json code editor'), { target: { value: '{' } });
  await userEvent.click(screen.getByRole('button', { name: 'Apply cv.json changes' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON');
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(puts).toHaveLength(0);
});
afterEach(() => vi.unstubAllGlobals());

function mount() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/dashboard/advanced-cv/p1']}><Routes><Route path="/dashboard/advanced-cv/:projectId" element={<CvEditor />} /></Routes></MemoryRouter></QueryClientProvider>);
}
function server(putStatus = 200) {
  const puts: { revision: number; content: { summary: string } }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path.includes('/auth/csrf/')) return json({ csrfToken: 't' });
    if (init?.method === 'PUT') {
      puts.push(JSON.parse(String(init.body)));
      return putStatus === 200 ? json({ project: { id: 'p1', title: 'My CV', kind: 'advanced_cv' }, content: {}, design: {}, revision: 2 }) : json({ detail: 'This document was changed elsewhere.', revision: 5 }, putStatus);
    }
    if (path.endsWith('/ats-check/')) return json({ score: 85, checks: [{ category: 'Contact information', status: 'pass', message: 'Present.' }], disclaimer: 'Advisory only.' });
    if (path.endsWith('/content-analysis/')) return json({ findings: [{ category: 'Summary quality', severity: 'warning', message: 'Add more detail.' }], suggestions: [{ id: 's1', label: 'Improve summary', section: 'summary', preview: 'Strong summary text' }] });
    if (path.endsWith('/files/')) return json({ files: { 'CV.tsx': 'export function CV() {}', 'style.css': '.cv-page {}', 'cv.json': '{}' } });
    if (path.endsWith('/document/')) return json({ project: { id: 'p1', title: 'My CV', kind: 'advanced_cv' }, content: { personal: { name: 'Sam Lee' }, summary: 'Hello' }, design: {}, revision: 1 });
    return json({});
  }));
  return puts;
}

it('renders structured content and hides hidden sections', () => {
  const doc = normalize({ content: { ...emptyContent({ name: 'Sam Lee' }), summary: 'Builder of things', skills: [{ id: '1', name: 'Python' }, { id: '2', name: 'React' }] }, design: { ...defaultDesign(), hidden: ['skills'] } });
  render(<CvDocument doc={doc} />);
  expect(screen.getByRole('heading', { name: 'Sam Lee' })).toBeVisible();
  expect(screen.getByText('Builder of things')).toBeVisible();
  expect(screen.queryByText('Python, React')).not.toBeInTheDocument();
});

it('loads the CV, previews edits live and autosaves with the current revision', async () => {
  const puts = server();
  mount();
  const name = await screen.findByLabelText('Full name');
  expect(name).toHaveValue('Sam Lee');
  await userEvent.clear(name);
  await userEvent.type(name, 'Samantha Lee');
  expect(screen.getByRole('heading', { name: 'Samantha Lee' })).toBeVisible();
  expect(screen.getByRole('status', { name: '' })).toBeDefined();
  await waitFor(() => expect(puts).toHaveLength(1), { timeout: 5000 });
  expect(puts[0].revision).toBe(1);
  expect(await screen.findByText('All changes saved', {}, { timeout: 3000 })).toBeVisible();
});

it('pauses editing and offers the latest version when the revision is stale', async () => {
  server(409);
  mount();
  await userEvent.type(await screen.findByLabelText('Professional title'), 'Engineer');
  expect(await screen.findByText('Out of date', {}, { timeout: 5000 })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Load latest version' })).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('Editing is paused');
});

it('runs ATS Checker, Content Analyzer, and Files & Code editor', async () => {
  server();
  mount();
  await screen.findByLabelText('Full name');
  await userEvent.click(screen.getByRole('button', { name: 'ATS Checker' }));
  expect(await screen.findByText('ATS Readiness Score: 85%')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

  await userEvent.click(screen.getByRole('button', { name: 'Content Analyzer' }));
  expect(await screen.findByText('Improve summary')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

  await userEvent.click(screen.getByRole('button', { name: /Files & Code/i }));
  expect(await screen.findByLabelText('cv.json code editor')).toBeVisible();
});
