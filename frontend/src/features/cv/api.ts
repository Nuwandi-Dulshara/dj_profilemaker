import { API_BASE_URL, apiFetch, apiRequest } from '../../api/client';
import type { CvIntegrations, SavedCv } from './integrations';

export type Provider = 'google' | 'microsoft';
export type Connections = Record<Provider, { configured: boolean; connected: boolean }>;
export interface DriveFile { id: string; name: string; modifiedTime: string }
export interface DriveList { files: DriveFile[]; nextPageToken?: string }
const documentPath = (id: string) => `/api/cv/documents/${encodeURIComponent(id)}/`;
const proof = (saved: SavedCv) => JSON.stringify({ confirmation: saved.confirmation });

export const cvApi = {
  status: () => apiRequest<Connections>('/api/cv/status/'),
  list: (pageToken?: string) => apiRequest<DriveList>(`/api/cv/documents/${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''}`),
  load: (id: string) => apiRequest<SavedCv>(documentPath(id)),
  remove: (saved: SavedCv) => apiRequest<void>(documentPath(saved.fileId), { method: 'DELETE', body: proof(saved) }),
  disconnect: (provider: Provider) => apiRequest<void>(`/api/cv/oauth/${provider}/disconnect/`, { method: 'POST' }),
};

export const cvIntegrations: CvIntegrations = {
  drive: {
    saveSource: (source, previous) => apiRequest<SavedCv>(previous ? documentPath(previous.fileId) : '/api/cv/documents/', {
      method: previous ? 'PUT' : 'POST', body: JSON.stringify({ ...source, ...(previous ? { confirmation: previous.confirmation } : {}) }),
    }),
    loadSource: cvApi.load,
    exportPdf: saved => apiRequest(documentPath(saved.fileId) + 'export/google/', { method: 'POST', body: proof(saved) }),
  },
  oneDrive: {
    exportPdf: saved => apiRequest(documentPath(saved.fileId) + 'export/microsoft/', { method: 'POST', body: proof(saved) }),
  },
  renderPdf: async saved => (await apiFetch(documentPath(saved.fileId) + 'pdf/', { method: 'POST', body: proof(saved) })).blob(),
};

export function connectProvider(provider: Provider): Promise<void> {
  // Open synchronously from the click so popup blockers do not discard the editor.
  const popup = window.open('about:blank', 'cv-cloud-auth', 'width=620,height=760');
  if (!popup) return Promise.reject(new Error('Allow popups to connect your cloud account. Your edits remain here.'));
  return new Promise((resolve, reject) => {
    const expectedOrigin = new URL(API_BASE_URL || window.location.origin, window.location.origin).origin;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', receive);
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      popup.close();
      if (error) reject(error); else resolve();
    };
    const receive = (event: MessageEvent) => {
      // Callback may be on the explicitly configured backend origin (dev :8000).
      if (event.source !== popup || event.origin !== callbackOrigin || event.data?.type !== 'cv-oauth' || event.data.provider !== provider) return;
      finish(event.data.success ? undefined : new Error(event.data.message || 'Cloud connection failed.'));
    };
    let callbackOrigin = expectedOrigin;
    window.addEventListener('message', receive);
    const poll = window.setInterval(() => { if (popup.closed) finish(new Error('Connection window closed. Refresh connections to check whether it completed.')); }, 750);
    const timeout = window.setTimeout(() => finish(new Error('Cloud authorization timed out. Please connect again.')), 600_000);
    apiRequest<{ url: string }>(`/api/cv/oauth/${provider}/start/`, { method: 'POST' }).then(({ url }) => {
      const authorization = new URL(url);
      callbackOrigin = new URL(authorization.searchParams.get('redirect_uri') || expectedOrigin).origin;
      if (!settled) popup.location.href = url;
    }).catch(error => finish(error instanceof Error ? error : new Error('Cloud connection failed.')));
  });
}
