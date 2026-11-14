import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPages';
import { SessionBoundary } from './AuthProvider';

const config = { registration_enabled: true, terms_url: 'https://example.test/terms', privacy_url: 'https://example.test/privacy', policy_version: 'test-v1', development_email: true };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route element={<SessionBoundary guest />}>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
    </Route>
    <Route element={<SessionBoundary />}><Route path="/dashboard" element={<h1>Private workspace</h1>} /></Route>
  </Routes></MemoryRouter></QueryClientProvider>);
  return client;
}

function server(handler?: (path: string, options?: RequestInit) => Response | Promise<Response> | undefined) {
  vi.stubGlobal('fetch', vi.fn(async (input: string, options?: RequestInit) => {
    const custom = handler?.(input, options);
    if (custom) return custom;
    if (input === '/api/auth/me/') return response({ user: null });
    if (input === '/api/auth/config/') return response(config);
    if (input === '/api/auth/csrf/') return response({ csrfToken: 'test-csrf' });
    throw new Error(`Unexpected request: ${input}`);
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('authentication integration', () => {
  it('waits for session resolution before redirecting a protected route', async () => {
    let resolveSession!: (value: Response) => void;
    server(path => path === '/api/auth/me/' ? new Promise(resolve => { resolveSession = resolve; }) : undefined);
    mount('/dashboard');
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    resolveSession(response({ user: null }));
    expect(await screen.findByRole('heading', { name: 'Welcome Back!' })).toBeVisible();
    expect(screen.queryByText('Private workspace')).not.toBeInTheDocument();
  });

  it('keeps bootstrap failures visible and allows retry without treating them as signed out', async () => {
    let failed = true;
    server(path => path === '/api/auth/me/' ? response(failed ? { detail: 'Service unavailable' } : { user: null }, failed ? 503 : 200) : undefined);
    mount('/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    expect(screen.queryByRole('heading', { name: 'Welcome Back!' })).not.toBeInTheDocument();
    failed = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Welcome Back!' })).toBeVisible();
  });

  it('redirects a signed-in visitor away from login', async () => {
    server(path => path === '/api/auth/me/' ? response({ user: { id: 1, email: 'alex@example.test', first_name: 'Alex', last_name: 'Morgan' } }) : undefined);
    mount('/login');
    expect(await screen.findByRole('heading', { name: 'Private workspace' })).toBeVisible();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('prevents duplicate login submission and displays the API failure', async () => {
    let finish!: (value: Response) => void;
    const submissions: RequestInit[] = [];
    server((path, options) => {
      if (path === '/api/auth/login/') {
        submissions.push(options!);
        return new Promise(resolve => { finish = resolve; });
      }
    });
    mount('/login');
    await userEvent.type(await screen.findByLabelText('Email Address'), 'alex@example.test');
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Incorrect-Password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(submissions).toHaveLength(1));
    const pending = screen.getByRole('button', { name: /Please wait/ });
    expect(pending).toBeDisabled();
    await userEvent.click(pending);
    expect(submissions).toHaveLength(1);
    expect(new Headers(submissions[0].headers).get('X-CSRFToken')).toBe('test-csrf');
    expect(submissions[0].credentials).toBe('same-origin');
    finish(response({ detail: 'The email or password is incorrect.' }, 400));
    expect(await screen.findByRole('alert')).toHaveTextContent('email or password is incorrect');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  it('rejects mismatched registration passwords before sending a registration request', async () => {
    let submitted = false;
    server(path => { if (path === '/api/auth/register/') { submitted = true; return response({}); } });
    mount('/register');
    await userEvent.type(await screen.findByLabelText('First Name'), 'Alex');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Morgan');
    await userEvent.type(screen.getByLabelText('Email Address'), 'alex@example.test');
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Clear-River!Strange-82');
    await userEvent.type(screen.getByLabelText('Confirm Password', { exact: true }), 'Different-Phrase!82');
    await userEvent.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(await screen.findByText('Passwords must match.')).toBeVisible();
    expect(submitted).toBe(false);
  });

  it('disables registration when published policies are unavailable', async () => {
    server(path => path === '/api/auth/config/' ? response({ ...config, registration_enabled: false, terms_url: '', privacy_url: '', policy_version: '' }) : undefined);
    mount('/register');
    expect(await screen.findByText(/Registration will be available after/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeDisabled();
    expect(screen.queryByRole('checkbox', { name: /I agree/ })).not.toBeInTheDocument();
  });
});
