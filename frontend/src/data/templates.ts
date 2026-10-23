export type TemplateId = 'professional' | 'creative' | 'minimal' | 'modern';
export interface Skill { id: string; name: string; level: number }
export interface SocialLink { id: string; platform: string; url: string }
export interface Profile {
  id: string | null; name: string; title: string; bio: string; email: string;
  phone: string; location: string; photo: string; template_id: TemplateId;
  skills: Skill[]; links: SocialLink[]; slug: string;
}
export const templates: { id: TemplateId; name: string; description: string }[] = [
  { id: 'professional', name: 'Professional', description: 'Corporate and polished' },
  { id: 'creative', name: 'Creative', description: 'Colorful and expressive' },
  { id: 'minimal', name: 'Minimal', description: 'Simple and elegant' },
  { id: 'modern', name: 'Modern', description: 'Bold and contemporary' },
];
export const emptyProfile: Profile = { id: null, name: '', title: '', bio: '', email: '', phone: '', location: '', photo: '', template_id: 'professional', skills: [], links: [], slug: '' };
export const demoProfile: Profile = {
  id: 'demo', name: 'Alex Morgan', title: 'Full Stack Developer', bio: 'I build thoughtful digital experiences using modern web technologies.',
  email: 'alex@example.com', phone: '+94 77 123 4567', location: 'Colombo, Sri Lanka', photo: '', template_id: 'professional',
  skills: [{ id: 'skill-1', name: 'React', level: 90 }, { id: 'skill-2', name: 'Python', level: 85 }, { id: 'skill-3', name: 'Django', level: 80 }],
  links: [{ id: 'link-1', platform: 'GitHub', url: 'https://github.com/' }], slug: 'alex-morgan'
};
