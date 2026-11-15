import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { CvDesign } from '../../document-engine/schema';
export interface Template { id: string; name: string; description: string; categories: string[]; careers: string[]; layout: string; ats_risk: string; ats_notes: string; design: CvDesign; favorite: boolean; last_used_at: string | null; is_custom: boolean }
export function useTemplates<T>(path: string, enabled = true) { return useQuery({ queryKey: ['workspace', 'templates', path], queryFn: ({ signal }) => api<T>(path, { signal }), staleTime: 60000, retry: false, enabled }); }
