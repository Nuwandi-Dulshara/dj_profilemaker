import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { CoverLetterRoutes } from './CoverLetterRoutes';

afterEach(() => vi.unstubAllGlobals());
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function setup(fail = false, delayed = false) {
  const content = {
    applicant: { name: 'Sam', email: '', phone: '', location: '', linkedin: '', portfolio: '' },
    recipient: { company: '', hiringManager: '', jobTitle: '', department: '', reference: '', date: '' },
    letter: { greeting: 'Hello', opening: 'Original', experience: 'My experience', skills: '', company: '', value: '', closing: '', signOff: '', signature: '' },
    linkedCvId: null, template: 'Classic Professional',
  };
  let saved = { project: { id: 'p1', title: 'My letter', kind: 'cover_letter' }, content, design: {}, revision: 1, schema_version: 1 };
  const puts: typeof saved[] = [];
  const versions: typeof saved[] = [];
  let release: () => void = () => {};
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path.includes('/auth/csrf/')) return json({ csrfToken: 't' });
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)); puts.push(body);
      if (delayed && puts.length === 1) await new Promise<void>(resolve => { release = resolve; });
      if (fail) return json({ detail: 'Changed elsewhere' }, 409);
      saved = { ...saved, ...body, revision: body.revision + 1 };
      return json(saved);
    }
    if (path.endsWith('/versions/')) { versions.push(saved); return json({ id: 1 }); }
    return json(saved);
  }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/dashboard/cover-letters/p1']}><Routes><Route path="/dashboard/*" element={<CoverLetterRoutes />} /></Routes></MemoryRouter></QueryClientProvider>);
  return { puts, versions, release: () => release() };
}

it('marks edits unsaved, warns on close, and autosaves the latest content', async () => {
  const { puts } = setup();
  await screen.findByDisplayValue('Original');
  fireEvent.change(screen.getByLabelText('Opening paragraph'), { target: { value: 'Updated' } });
  expect(screen.getByText('Unsaved changes')).toBeVisible();
  const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await waitFor(() => expect(puts).toHaveLength(1), { timeout: 3000 });
  expect(puts[0].content.letter.opening).toBe('Updated');
  expect(await screen.findByText('All changes saved')).toBeVisible();
});

it('preserves edits made during a save and uses the returned revision', async () => {
  const server = setup(false, true);
  await screen.findByDisplayValue('Original');
  fireEvent.change(screen.getByLabelText('Opening paragraph'), { target: { value: 'First' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(server.puts).toHaveLength(1));
  fireEvent.change(screen.getByLabelText('Opening paragraph'), { target: { value: 'Second' } });
  server.release();
  await waitFor(() => expect(server.puts).toHaveLength(2), { timeout: 3000 });
  expect(server.puts[1].revision).toBe(2);
  expect(server.puts[1].content.letter.opening).toBe('Second');
  expect(screen.getByLabelText('Opening paragraph')).toHaveValue('Second');
});

it('saves pending edits before creating a version', async () => {
  const { versions } = setup();
  await screen.findByDisplayValue('Original');
  fireEvent.change(screen.getByLabelText('Opening paragraph'), { target: { value: 'Version text' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Version' }));
  await waitFor(() => expect(versions).toHaveLength(1));
  expect(versions[0].content.letter.opening).toBe('Version text');
});

it('keeps a conflicting draft and blocks version creation', async () => {
  const { versions } = setup(true);
  await screen.findByDisplayValue('Original');
  fireEvent.change(screen.getByLabelText('Opening paragraph'), { target: { value: 'Keep me' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Version' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Changed elsewhere');
  expect(versions).toHaveLength(0);
  expect(screen.getByLabelText('Opening paragraph')).toHaveValue('Keep me');
});
