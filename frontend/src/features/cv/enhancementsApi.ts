import { apiFetch, apiRequest } from '../../api/client';
import type { CvSource, SavedCv } from './integrations';

export interface Issue { id:string; severity:string; kind:string; section:string; message:string; recommendation:string; priority:number }
export interface Asset { id:string; name:string; fileId:string; source:CvSource; layoutSource?:CvSource|null; text:string; mime:string; conversion:string; issues:Issue[]; limitations:string[]; uncertain:{text:string; confidence:number}[] }
export interface AnalysisResult {
  scores: Record<string, number | null>; overall:number | null; issues:Issue[];
  sections:unknown; contacts:unknown; job:unknown; methodology:unknown; limitations:string[];
}
export interface AnalysisRecord {id:string; digest:string; createdAt:string; fileId?:string; result:AnalysisResult}
export interface Suggestion {id:string; original:string; replacement:string; reason:string; section:string; requiresConfirmation:boolean}
export const enhancements = {
  upload: (file:File) => {const data=new FormData(); data.set('file',file); return apiRequest<Asset>('/api/cv/imports/', {method:'POST',body:data});},
  assets: (fileId='') => apiRequest<{id:string; name:string; fileId:string}[]>(`/api/cv/imports/?fileId=${encodeURIComponent(fileId)}`),
  asset: (id:string) => apiRequest<Asset>(`/api/cv/imports/${id}/`),
  original: async (id:string) => (await apiFetch(`/api/cv/imports/${id}/original/`)).blob(),
  removeAsset: (id:string) => apiRequest<void>(`/api/cv/imports/${id}/`,{method:'DELETE'}),
  link: (asset:Asset,saved:SavedCv) => apiRequest<Asset>(`/api/cv/imports/${asset.id}/`,{method:'PATCH',body:JSON.stringify({fileId:saved.fileId,confirmation:saved.confirmation})}),
  reconstruct: (text:string,title:string) => apiRequest<CvSource>('/api/cv/reconstruct/',{method:'POST',body:JSON.stringify({text,title})}),
  job: (file:File) => {const data=new FormData(); data.set('file',file); return apiRequest<{text:string; limitations:string[]; name:string}>('/api/cv/job-description/',{method:'POST',body:data});},
  analyze: (source:CvSource,jobDescription:string,fileId?:string,assetId?:string) => apiRequest<AnalysisRecord>('/api/cv/analyze/',{method:'POST',body:JSON.stringify({source,jobDescription,fileId:fileId ?? '',assetId})}),
  history: (fileId='') => apiRequest<AnalysisRecord[]>(`/api/cv/history/?fileId=${encodeURIComponent(fileId)}`),
  improve: (source:CvSource,jobDescription:string,targetRole:string) => apiRequest<{id:string; digest:string; suggestions:Suggestion[]}>('/api/cv/improve/',{method:'POST',body:JSON.stringify({source,jobDescription,targetRole})}),
  revisions: (id:string) => apiRequest<{id:number; digest:string; createdAt:string; source:CvSource}[]>(`/api/cv/documents/${encodeURIComponent(id)}/revisions/`),
};
