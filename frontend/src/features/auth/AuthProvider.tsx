import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../../services/api';

export interface SessionUser { id: number; email: string; first_name: string; last_name: string; }
export interface Session { user: SessionUser | null; }
export function useSession() { return useQuery({ queryKey: ['session'], queryFn: () => api<Session>('/auth/me/'), retry: false, staleTime: 60000 }); }

export function SessionBoundary({ guest = false }: { guest?: boolean }) {
  const session = useSession();
  if (session.isPending) return <main className="route-message" role="status">Checking your session…</main>;
  if (session.isError) return <main className="route-message"><h1>Unable to check your session</h1><p role="alert">{session.error.message}</p><button className="button button-primary" onClick={() => session.refetch()}>Try again</button></main>;
  if (guest && session.data.user) return <Navigate to="/dashboard" replace />;
  if (!guest && !session.data.user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Authenticated entry only. Dashboard features are introduced by module 02. */
export function DashboardEntry() {
  const { data } = useSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setPending(true); setError('');
    try { await api('/auth/logout/', { method: 'POST' }); client.clear(); client.setQueryData(['session'], { user: null }); navigate('/login', { replace: true }); }
    catch (err) { setError((err as Error).message); }
    finally { setPending(false); }
  }
  return <main className="route-message"><span className="eyebrow">YOUR SECURE WORKSPACE</span><h1>Welcome, {data?.user?.first_name || 'there'}</h1><p>You are signed in. Dashboard and document tools are still being implemented; no projects have been created.</p>{error && <p role="alert">{error}</p>}<button className="button button-primary" disabled={pending} onClick={signOut}>{pending ? 'Signing out…' : 'Logout'}</button></main>;
}
