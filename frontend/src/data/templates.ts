export type TemplateId =
  | 'professional'
  | 'creative'
  | 'minimal'
  | 'modern'
  | 'executive'
  | 'developer'
  | 'elegant'
  | 'magazine'
  | 'bold'
  | 'startup';

export interface Skill {
  id: string;
  name: string;
  level: number;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  current?: boolean;
  description: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  image?: string;
  demoUrl?: string;
  githubUrl?: string;
  tags?: string;
}

export interface Profile {
  id: string | null;
  name: string;
  title: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  photo: string;
  template_id: TemplateId;
  skills: Skill[];
  links: SocialLink[];
  slug: string;
  experiences?: Experience[];
  education?: Education[];
  projects?: Project[];
  views_count?: number;
  is_published?: boolean;
}

export const templates: { id: TemplateId; name: string; description: string; badge: string }[] = [
  { id: 'professional', name: 'Professional', description: 'Corporate, polished, structured', badge: 'Popular' },
  { id: 'creative', name: 'Creative', description: 'Colorful, expressive, high-energy', badge: 'Vibrant' },
  { id: 'minimal', name: 'Minimal', description: 'Simple, elegant, monochrome typography', badge: 'Clean' },
  { id: 'modern', name: 'Modern', description: 'Contemporary grid with indigo accents', badge: 'Trendy' },
  { id: 'executive', name: 'Executive', description: 'Refined slate tones with gold accents', badge: 'Leadership' },
  { id: 'developer', name: 'Developer', description: 'Dark terminal style with code badges', badge: 'Tech' },
  { id: 'elegant', name: 'Elegant', description: 'Soft editorial aesthetics and serif typography', badge: 'Artistic' },
  { id: 'magazine', name: 'Magazine', description: 'Bold asymmetric layout & cover feel', badge: 'Editorial' },
  { id: 'bold', name: 'Bold Cyber', description: 'High contrast dynamic neon aesthetics', badge: 'Futuristic' },
  { id: 'startup', name: 'Startup', description: 'Emerald gradient with modern SaaS vibe', badge: 'Product' },
];

export const emptyProfile: Profile = {
  id: null,
  name: '',
  title: '',
  bio: '',
  email: '',
  phone: '',
  location: '',
  photo: '',
  template_id: 'professional',
  skills: [],
  links: [],
  slug: '',
  experiences: [],
  education: [],
  projects: [],
  views_count: 0,
  is_published: true,
};

export const demoProfile: Profile = {
  id: 'demo',
  name: 'Alex Morgan',
  title: 'Senior Full Stack Engineer',
  bio: 'Passionate software architect with 6+ years of experience designing scalable web systems and elegant digital products. Enthusiast of clean code, distributed architectures, and intuitive UI/UX.',
  email: 'alex.morgan@example.com',
  phone: '+94 77 123 4567',
  location: 'Colombo, Sri Lanka',
  photo: '',
  template_id: 'professional',
  skills: [
    { id: 'skill-1', name: 'React & TypeScript', level: 95 },
    { id: 'skill-2', name: 'Python & Django', level: 90 },
    { id: 'skill-3', name: 'MySQL & PostgreSQL', level: 85 },
    { id: 'skill-4', name: 'Cloud Architecture (Docker, GCP)', level: 80 },
  ],
  links: [
    { id: 'link-1', platform: 'GitHub', url: 'https://github.com' },
    { id: 'link-2', platform: 'LinkedIn', url: 'https://linkedin.com' },
    { id: 'link-3', platform: 'Portfolio', url: 'https://example.com' },
  ],
  experiences: [
    {
      id: 'exp-1',
      role: 'Lead Full Stack Developer',
      company: 'Apex Cloud Solutions',
      startDate: '2022',
      endDate: 'Present',
      current: true,
      description: 'Architecting distributed microservices and modern React applications serving 100k+ monthly active users.',
    },
    {
      id: 'exp-2',
      role: 'Software Engineer',
      company: 'InnoTech Labs',
      startDate: '2019',
      endDate: '2022',
      current: false,
      description: 'Developed scalable RESTful APIs in Django and dynamic interactive user dashboards.',
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'University of Colombo',
      degree: 'B.Sc. (Hons) in Computer Science',
      fieldOfStudy: 'Software Engineering',
      startDate: '2015',
      endDate: '2019',
    },
  ],
  projects: [
    {
      id: 'proj-1',
      title: 'Profile Studio Pro',
      description: 'A full-featured digital identity builder with real-time multi-template preview and export.',
      demoUrl: 'https://example.com',
      githubUrl: 'https://github.com',
      tags: 'React, TypeScript, Django, MySQL',
    },
    {
      id: 'proj-2',
      title: 'Cloud Metrics Engine',
      description: 'High-throughput system observability dashboard with sub-second alert telemetry.',
      demoUrl: 'https://example.com',
      githubUrl: 'https://github.com',
      tags: 'Python, Redis, WebSockets',
    },
  ],
  slug: 'alex-morgan',
  views_count: 142,
  is_published: true,
};
