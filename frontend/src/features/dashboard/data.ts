import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

export interface Page<T> { count: number; results: T[]; next: string | null; previous: string | null; }
export interface Project { id: string; title: string; kind: 'advanced_cv' | 'template_cv' | 'cover_letter'; favorite: boolean; archived: boolean; folder: string | null; folder_name: string | null; created_at?: string; updated_at: string; deleted_at: string | null; }
export interface Folder { id: string; name: string; parent?: string | null; parent_name?: string | null; project_count?: number; }
export interface Notice { id: string; title: string; message: string; is_read: boolean; kind: string; created_at: string; }
export interface ActivityItem { id: number; project: string | null; title: string; action: string; created_at: string; }
export interface StorageInfo { used_bytes: number; quota_bytes: number | null; scope: string; }
export interface ProjectStats { total: number; active: number; favorites: number; archived: number; advanced_cv: number; template_cv: number; cover_letter: number; deleted: number; }
export interface Summary { counts: { total: number; advanced_cv: number; template_cv: number; cover_letter: number; deleted: number }; project_stats?: ProjectStats; profile: { sections: { key: string; label: string; complete: boolean }[]; completed: number; total: number; percent: number }; workflows: Record<string, boolean>; }
export type ProjectsResponse = Page<Project> & { stats?: ProjectStats };
export type NotificationsResponse = Page<Notice> & { unread_count?: number };
export const kindNames: Record<Project['kind'], string> = { advanced_cv: 'Advanced CV', template_cv: 'Template-based CV', cover_letter: 'Cover letter' };
export function getProjectEditorPath(project: Pick<Project, 'id' | 'kind'>) {
  return project.kind === 'cover_letter' ? `/dashboard/cover-letters/${project.id}` : `/dashboard/advanced-cv/${project.id}`;
}
export function useWorkspace<T>(key: string, path: string) {
  return useQuery({ queryKey: ['workspace', key, path], queryFn: ({ signal }) => api<T>(path, { signal }), retry: false, staleTime: 15000 });
}
export function useRefreshWorkspace() { const client = useQueryClient(); return useCallback(() => client.invalidateQueries({ queryKey: ['workspace'] }), [client]); }
export const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
export function bytes(value: number) { return value < 1024 ? `${value} B` : value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 ** 2).toFixed(1)} MB`; }
