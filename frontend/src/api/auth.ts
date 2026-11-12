import { apiRequest, clearLegacyAuth } from './client';

export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  status: string;
  message: string;
  user: User;
}

export interface SettingsPayload {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

export const authApi = {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>('/api/auth/session/register/', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    clearLegacyAuth();
    return res;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>('/api/auth/session/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    clearLegacyAuth();
    return res;
  },

  async logout(): Promise<void> {
    await apiRequest('/api/auth/logout/', { method: 'POST' });
    clearLegacyAuth();
  },

  async getMe(): Promise<User> {
    const res = await apiRequest<{ status: string; user: User }>('/api/auth/me/');
    return res.user;
  },

  async updateSettings(data: SettingsPayload): Promise<User> {
    const res = await apiRequest<{ status: string; message: string; user: User }>(
      '/api/auth/settings/',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return res.user;
  },

  async forgotPassword(email: string): Promise<{ status: string; message: string }> {
    return apiRequest<{ status: string; message: string }>('/api/auth/forgot-password/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(password: string, email?: string): Promise<{ status: string; message: string }> {
    return apiRequest<{ status: string; message: string }>('/api/auth/reset-password/', {
      method: 'POST',
      body: JSON.stringify({ password, email }),
    });
  },

  async resendVerification(): Promise<{ status: string; message: string }> {
    return apiRequest<{ status: string; message: string }>('/api/auth/resend-verification/', {
      method: 'POST',
    });
  },

};
