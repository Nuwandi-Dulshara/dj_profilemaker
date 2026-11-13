import type { Profile } from '../../data/templates';
import type { CvSource } from './integrations';

export type CvTemplate = 'professional' | 'minimal' | 'executive';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));

export function profileSource(profile: Profile, template: CvTemplate = 'professional'): CvSource {
  const paragraph = (value: unknown) => value ? `<p>${escape(value)}</p>` : '';
  const section = (title: string, content: string) => content ? `<section><h2>${title}</h2>${content}</section>` : '';
  const dates = (start?: string, end?: string, current?: boolean) => [start, current ? 'Present' : end].filter(Boolean).join(' – ');
  const experience = (profile.experiences ?? []).map(item => `<article><h3>${escape(item.role)} — ${escape(item.company)}</h3>${paragraph(dates(item.startDate, item.endDate, item.current))}${paragraph(item.description)}</article>`).join('');
  const education = (profile.education ?? []).map(item => `<article><h3>${escape(item.degree)} — ${escape(item.institution)}</h3>${paragraph(item.fieldOfStudy)}${paragraph(dates(item.startDate, item.endDate))}</article>`).join('');
  const projects = (profile.projects ?? []).map(item => `<article><h3>${escape(item.title)}</h3>${paragraph(item.description)}${paragraph(item.tags)}${paragraph(item.demoUrl)}${paragraph(item.githubUrl)}</article>`).join('');
  const color = {professional:'#1e3a8a', minimal:'#111827', executive:'#4a3d25'}[template];
  return {
    title: `${profile.name || 'Untitled'} CV`,
    html: `<main class="cv-document"><h1>${escape(profile.name)}</h1>${paragraph(profile.title)}${paragraph([profile.email, profile.phone, profile.location].filter(Boolean).join(' | '))}${(profile.links ?? []).map(item => paragraph(item.url)).join('')}${section('Professional Summary', paragraph(profile.bio))}${section('Work Experience', experience)}${section('Education', education)}${section('Technical Skills', profile.skills.length ? '<ul>' + profile.skills.map(item => `<li>${escape(item.name)}</li>`).join('') + '</ul>' : '')}${section('Projects', projects)}</main>`,
    css: `@page {size:A4; margin:16mm} body {width:210mm; padding:16mm; color:#17233b; font:11pt/1.5 ${template === 'executive' ? 'Georgia,serif' : 'Arial,sans-serif'}} h1 {font-size:25pt; color:${color}} h2 {font-size:13pt; color:${color}; border-bottom:1px solid #cbd5e1; margin-top:6mm} h3 {font-size:11pt; margin-top:4mm} p {white-space:pre-wrap; margin:0 0 3mm} h1,h2,h3 {break-after:avoid} li {break-inside:avoid} @media print {body {width:auto; min-height:0; padding:0; margin:0}}`,
  };
}
