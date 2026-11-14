import type { ReactNode } from 'react';

export function QueryState({ pending, error, retry, children }: { pending: boolean; error: Error | null; retry: () => unknown; children: ReactNode }) {
  if (pending) return <div className="dash-skeleton" role="status" aria-label="Loading dashboard data"><span /><span /><span /></div>;
  if (error) return <div className="dash-error" role="alert"><p>{error.message}</p><button className="dash-link" onClick={retry}>Try again</button></div>;
  return <>{children}</>;
}
