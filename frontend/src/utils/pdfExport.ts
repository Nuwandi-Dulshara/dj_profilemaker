import toast from 'react-hot-toast';
import { apiFetch } from '../api/client';
import type { Profile } from '../data/templates';

let downloading = false;

/** Render current profile text as a CV, independently of the portfolio UI. */
export async function exportProfileAsPdf(profile: Profile, filename = 'resume.pdf') {
  if (downloading) return;
  downloading = true;
  const toastId = toast.loading('Generating professional PDF resume...');
  try {
    const payload = {
      name: profile.name, title: profile.title, bio: profile.bio,
      email: profile.email, phone: profile.phone, location: profile.location,
      template_id: profile.template_id,
      links: profile.links.map(({ platform, url }) => ({ platform, url })),
      skills: profile.skills.map(({ name }) => ({ name })),
      experiences: profile.experiences ?? [], education: profile.education ?? [],
      projects: (profile.projects ?? []).map(({ title, description, tags, demoUrl, githubUrl }) => ({title, description, tags, demoUrl, githubUrl})),
    };
    const response = await apiFetch('/api/profiles/resume/', {method:'POST', body:JSON.stringify(payload)});
    const blob = await response.blob();
    if (!blob.size || !blob.type.includes('application/pdf')) throw new Error('The server did not return a valid PDF.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success('PDF resume downloaded.', {id:toastId});
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not generate the PDF. Please retry.', {id:toastId});
  } finally {
    downloading = false;
  }
}
