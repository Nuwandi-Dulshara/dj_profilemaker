import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { TemplateRoutes } from './TemplateRoutes';
import { defaultDesign } from '../../document-engine/schema';

const template = { id: 'classic-ats', name: 'Classic ATS', description: 'Linear layout', categories: ['Professional'], careers: [], layout: 'single', ats_risk: 'low', ats_notes: 'Estimated risk only', design: defaultDesign(), favorite: false, is_custom: false };
afterEach(() => vi.unstubAllGlobals());
function mount(path = '/dashboard/cv-templates') { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Routes><Route path="/dashboard/*" element={<TemplateRoutes />} /></Routes></MemoryRouter></QueryClientProvider>); }
it('combines gallery filters through the API and preserves switch context', async () => {
 const paths: string[] = [];
 vi.stubGlobal('fetch', vi.fn(async (path: string) => { paths.push(path); return new Response(JSON.stringify({ results: [template], count: 1, next: null, previous: null })); }));
 mount('/dashboard/cv-templates?project=p1&revision=4');
 await screen.findByText('Classic ATS');
 fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Modern' } });
 fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'sidebar' } });
 await waitFor(() => expect(paths.some(p => p.includes('category=Modern') && p.includes('layout=sidebar'))).toBe(true));
 expect(await screen.findByRole('link', { name: 'Preview Classic ATS' })).toHaveAttribute('href', '/dashboard/cv-templates/classic-ats?project=p1&revision=4');
});
it('labels sample data and retries creation with the same key without sending sample content', async () => {
 const bodies: Record<string, unknown>[] = [];
 vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
  if (path.includes('/csrf/')) return new Response(JSON.stringify({ csrfToken: 't' }));
  if (path === '/api/projects/') { bodies.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ detail: 'Try again' }), { status: 503 }); }
  return new Response(JSON.stringify(template));
 }));
 mount('/dashboard/cv-templates/classic-ats');
 await screen.findByText('Sample data — fictional preview only');
 fireEvent.click(screen.getByRole('button', { name: 'Use Template' }));
 await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button', { name: 'Use Template' }));
 await waitFor(() => expect(bodies).toHaveLength(2));
 expect(bodies[0].idempotency_key).toBe(bodies[1].idempotency_key);
 expect(bodies[0].import_profile).toBe(false);
 expect(bodies[0]).not.toHaveProperty('content');
});

