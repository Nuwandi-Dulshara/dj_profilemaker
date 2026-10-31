import { apiRequest, setAuthToken, removeAuthToken } from './client';

export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  status: string;
  message: string;
  token: string;
  user: User;
}

export const authApi = {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setAuthToken(res.token);
    localStorage.setItem('profile_studio_user', JSON.stringify(res.user));
    return res;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    localStorage.setItem('profile_studio_user', JSON.stringify(res.user));
    return res;
  },

  async logout(): Promise<void> {
    try {
      await apiRequest('/api/auth/logout/', { method: 'POST' });
    } catch {
      // Continue cleanup even if server token delete fails
    } finally {
      removeAuthToken();
      localStorage.removeItem('profile_studio_user');
    }
  },

  async getMe(): Promise<User> {
    const res = await apiRequest<{ status: string; user: User }>('/api/auth/me/');
    localStorage.setItem('profile_studio_user', JSON.stringify(res.user));
    return res.user;
  },

  getSavedUser(): User | null {
    try {
      const userStr = localStorage.getItem('profile_studio_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
};
