import { apiRequest } from './client';
import type { Profile } from '../data/templates';

export interface DashboardStats {
  total_profiles: number;
  total_skills: number;
  template_breakdown: Record<string, number>;
  latest_profile: {
    id: string;
    name: string;
    slug: string;
    updated_at: string;
  } | null;
}

function cleanProfilePayload(data: Partial<Profile>): Partial<Profile> {
  const payload = { ...data };
  if (!payload.id) {
    delete payload.id;
  }
  if (!payload.slug) {
    delete payload.slug;
  }
  if (payload.photo === '' || payload.photo === null) {
    delete payload.photo;
  }
  return payload;
}

export const profilesApi = {
  async getProfiles(search?: string): Promise<Profile[]> {
    const endpoint = search
      ? `/api/profiles/?search=${encodeURIComponent(search)}`
      : '/api/profiles/';
    return apiRequest<Profile[]>(endpoint);
  },

  async getProfile(id: string): Promise<Profile> {
    return apiRequest<Profile>(`/api/profiles/${id}/`);
  },

  async createProfile(data: Partial<Profile>): Promise<Profile> {
    return apiRequest<Profile>('/api/profiles/', {
      method: 'POST',
      body: JSON.stringify(cleanProfilePayload(data)),
    });
  },

  async updateProfile(id: string, data: Partial<Profile>): Promise<Profile> {
    return apiRequest<Profile>(`/api/profiles/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(cleanProfilePayload(data)),
    });
  },

  async deleteProfile(id: string): Promise<void> {
    return apiRequest<void>(`/api/profiles/${id}/`, {
      method: 'DELETE',
    });
  },

  async getPublicProfile(slug: string): Promise<Profile> {
    const res = await apiRequest<{ status: string; profile: Profile }>(
      `/api/public/p/${slug}/`
    );
    return res.profile;
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await apiRequest<{ status: string; stats: DashboardStats }>(
      '/api/profiles/dashboard/stats/'
    );
    return res.stats;
  },
};
