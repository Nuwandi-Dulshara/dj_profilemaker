export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

export function clearLegacyAuth(): void {
  // Remove credentials from previous versions; never read or write tokens here.
  localStorage.removeItem('profile_studio_token');
  localStorage.removeItem('profile_studio_user');
}

function errorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Request failed. Please retry.';
  const fields = data as Record<string, unknown>;
  if (typeof fields.detail === 'string') return fields.detail;
  if (typeof fields.message === 'string') return fields.message;
  const errors = fields.errors ?? fields;
  if (errors && typeof errors === 'object') {
    return Object.entries(errors).map(([key, value]) =>
      `${key}: ${Array.isArray(value) ? value.join(' ') : String(value)}`).join(' | ');
  }
  return 'Request failed. Please retry.';
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: 'include', cache: 'no-store' });
    if (!csrf.ok) throw new ApiError(csrf.status, 'Could not initialize a secure request. Please retry.');
    const data: { csrfToken: string } = await csrf.json();
    headers.set('X-CSRFToken', data.csrfToken);
  }
  const response = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
    ...options, headers, credentials: 'include', cache: 'no-store',
  });
  if (!response.ok) {
    const data: unknown = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : null;
    // Leave unsaved CV edits in memory when authentication or network requests fail.
    if (response.status === 401 && !window.location.pathname.startsWith('/cv-builder') &&
        !['/login', '/register'].includes(window.location.pathname) && !window.location.pathname.startsWith('/p/')) {
      window.location.href = '/login';
    }
    throw new ApiError(response.status, errorMessage(data), data);
  }
  return response;
}

export async function apiRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(endpoint, options);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
