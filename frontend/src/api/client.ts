const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('profile_studio_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('profile_studio_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('profile_studio_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type to json if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      localStorage.removeItem('profile_studio_user');
      if (
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/register') &&
        !window.location.pathname.startsWith('/p/')
      ) {
        window.location.href = '/login';
      }
      throw new ApiError(401, 'Please log in to continue.', data);
    }

    let message = 'Request failed';
    if (data && typeof data === 'object') {
      if (data.detail) {
        message = data.detail;
      } else if (data.message) {
        message = data.message;
      } else if (data.errors && typeof data.errors === 'object') {
        const errorMsgs: string[] = [];
        for (const key of Object.keys(data.errors)) {
          const val = data.errors[key];
          errorMsgs.push(`${key}: ${Array.isArray(val) ? val.join(' ') : val}`);
        }
        message = errorMsgs.join(' | ');
      } else {
        // DRF standard validation error: dict of { field: ["error message"] }
        const errorMsgs: string[] = [];
        for (const key of Object.keys(data)) {
          const val = data[key];
          if (Array.isArray(val)) {
            errorMsgs.push(`${key}: ${val.join(' ')}`);
          } else if (typeof val === 'string') {
            errorMsgs.push(`${key}: ${val}`);
          }
        }
        if (errorMsgs.length > 0) {
          message = errorMsgs.join(' | ');
        }
      }
    }
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}
