export class ApiError extends Error {
  constructor(public status: number, public fields: Record<string, unknown>, message: string) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    const csrf = await api<{ csrfToken: string }>('/auth/csrf/');
    headers.set('X-CSRFToken', csrf.csrfToken);
  }
  let response: Response;
  try { response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' }); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new Error('Unable to connect. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : Object.entries(data).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : String(value)}`).join(' ');
    throw new ApiError(response.status, data, detail || `The request could not be completed (${response.status}). Please try again.`);
  }
  return data as T;
}
