import type { Profile } from '../data/templates';
export const STORAGE_KEY = 'profile-studio-profiles';
export function readProfiles(): Profile[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(data) ? data as Profile[] : [];
  } catch { return []; }
}
export function writeProfiles(profiles: Profile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}
export function makeSlug(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
}
