/** Shared structured-document schema. Content is data; design is presentation. */
export type ListKey = 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'achievements' | 'publications' | 'languages' | 'volunteering' | 'references' | 'custom';
export type SectionKey = 'summary' | ListKey;
export interface FieldDef { key: string; label: string; multiline?: boolean; placeholder?: string }
export interface ListSectionDef { key: ListKey; label: string; itemLabel: string; fields: FieldDef[] }
export type Item = { id: string } & Record<string, string>;
export interface CvContent {
  personal: Record<'name' | 'title' | 'email' | 'phone' | 'location' | 'website', string>;
  summary: string;
  experience: Item[]; education: Item[]; skills: Item[]; projects: Item[]; certifications: Item[]; achievements: Item[];
  publications: Item[]; languages: Item[]; volunteering: Item[]; references: Item[]; custom: Item[];
}
export interface CvDesign {
  pageSize: 'A4' | 'Letter'; fontFamily: string; fontSize: number; accent: string; margin: number; order: SectionKey[]; hidden: SectionKey[];
  templateId: string; layout: 'single' | 'two-column' | 'sidebar'; textColor: string; lineHeight: number; sectionSpacing: number;
  headingStyle: 'line' | 'plain' | 'band'; headerStyle: 'left' | 'center' | 'banner'; headings: Partial<Record<SectionKey, string>>; pageBreaks: SectionKey[];
}
export interface CvDoc { content: CvContent; design: CvDesign }

export const personalFields: FieldDef[] = [
  { key: 'name', label: 'Full name' }, { key: 'title', label: 'Professional title' }, { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' }, { key: 'location', label: 'Location' }, { key: 'website', label: 'Website or profile link' },
];

export const listSections: ListSectionDef[] = [
  { key: 'experience', label: 'Work Experience', itemLabel: 'role', fields: [{ key: 'role', label: 'Job title' }, { key: 'company', label: 'Company' }, { key: 'start', label: 'Start date' }, { key: 'end', label: 'End date' }, { key: 'description', label: 'Responsibilities and achievements', multiline: true }] },
  { key: 'education', label: 'Education', itemLabel: 'qualification', fields: [{ key: 'degree', label: 'Degree or qualification' }, { key: 'institution', label: 'Institution' }, { key: 'start', label: 'Start date' }, { key: 'end', label: 'End date' }, { key: 'description', label: 'Details', multiline: true }] },
  { key: 'skills', label: 'Technical and Soft Skills', itemLabel: 'skill', fields: [{ key: 'name', label: 'Skill' }, { key: 'category', label: 'Category (for example Technical or Soft)' }] },
  { key: 'projects', label: 'Projects', itemLabel: 'project', fields: [{ key: 'title', label: 'Project name' }, { key: 'link', label: 'Link' }, { key: 'description', label: 'Description', multiline: true }] },
  { key: 'certifications', label: 'Certifications', itemLabel: 'certification', fields: [{ key: 'name', label: 'Certification' }, { key: 'issuer', label: 'Issuer' }, { key: 'date', label: 'Date' }] },
  { key: 'achievements', label: 'Achievements', itemLabel: 'achievement', fields: [{ key: 'title', label: 'Achievement' }, { key: 'description', label: 'Details', multiline: true }] },
  { key: 'publications', label: 'Research and Publications', itemLabel: 'publication', fields: [{ key: 'title', label: 'Title' }, { key: 'venue', label: 'Journal or venue' }, { key: 'date', label: 'Date' }, { key: 'description', label: 'Notes', multiline: true }] },
  { key: 'languages', label: 'Languages', itemLabel: 'language', fields: [{ key: 'name', label: 'Language' }, { key: 'level', label: 'Proficiency' }] },
  { key: 'volunteering', label: 'Volunteering', itemLabel: 'role', fields: [{ key: 'role', label: 'Role' }, { key: 'organization', label: 'Organisation' }, { key: 'date', label: 'Dates' }, { key: 'description', label: 'Details', multiline: true }] },
  { key: 'references', label: 'References', itemLabel: 'reference', fields: [{ key: 'name', label: 'Name' }, { key: 'relationship', label: 'Position and relationship' }, { key: 'contact', label: 'Contact details' }] },
  { key: 'custom', label: 'Custom Sections', itemLabel: 'entry', fields: [{ key: 'title', label: 'Heading' }, { key: 'description', label: 'Text', multiline: true }] },
];

export const sectionLabels: Record<SectionKey, string> = { summary: 'Professional Summary', ...Object.fromEntries(listSections.map(s => [s.key, s.label])) } as Record<SectionKey, string>;
export const defaultOrder: SectionKey[] = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'achievements', 'publications', 'languages', 'volunteering', 'references', 'custom'];
export const fonts = ['Georgia', 'Arial', 'Calibri', 'Times New Roman', 'Verdana', 'Trebuchet MS'];
export const pageSizes = { A4: { width: 794, height: 1123 }, Letter: { width: 816, height: 1056 } } as const;

export const defaultDesign = (): CvDesign => ({ pageSize: 'A4', fontFamily: 'Georgia', fontSize: 11, accent: '#0B1F3A', margin: 18, order: [...defaultOrder], hidden: [], templateId: 'classic-ats', layout: 'single', textColor: '#111827', lineHeight: 1.45, sectionSpacing: 1, headingStyle: 'line', headerStyle: 'left', headings: {}, pageBreaks: [] });

export function emptyContent(seed: Partial<CvContent['personal']> = {}): CvContent {
  return { personal: { name: '', title: '', email: '', phone: '', location: '', website: '', ...seed }, summary: '', experience: [], education: [], skills: [], projects: [], certifications: [], achievements: [], publications: [], languages: [], volunteering: [], references: [], custom: [] };
}

/** Fill missing keys so older or partial documents always render and edit safely. */
export function normalize(raw: { content?: unknown; design?: unknown }): CvDoc {
  const content = emptyContent();
  const source = (raw?.content && typeof raw.content === 'object' ? raw.content : {}) as Partial<CvContent>;
  for (const key of Object.keys(content.personal) as (keyof CvContent['personal'])[]) {
    if (typeof source.personal?.[key] === 'string') content.personal[key] = source.personal[key];
  }
  content.summary = typeof source.summary === 'string' ? source.summary : '';
  for (const section of listSections) {
    const items = source[section.key];
    content[section.key] = Array.isArray(items) ? items.filter(item => item && typeof item === 'object' && !Array.isArray(item)).map((item, index) => ({ ...Object.fromEntries(Object.entries(item).filter(([, v]) => typeof v === 'string')), id: typeof item.id === 'string' && item.id ? item.id : `${section.key}-${index}` })) : [];
  }
  const design = normalizeDesign(raw?.design);
  return { content, design };
}

export function normalizeDesign(raw: unknown): CvDesign {
  const defaults = defaultDesign();
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const number = (key: string, low: number, high: number, fallback: number) => typeof source[key] === 'number' && Number.isFinite(source[key]) ? Math.min(high, Math.max(low, source[key] as number)) : fallback;
  const color = (key: string, fallback: string) => typeof source[key] === 'string' && /^#[0-9a-f]{6}$/i.test(source[key] as string) ? source[key] as string : fallback;
  const keys = (value: unknown): SectionKey[] => Array.isArray(value) ? [...new Set(value.filter((k): k is SectionKey => defaultOrder.includes(k)))] : [];
  const order = keys(source.order);
  const headings = source.headings && typeof source.headings === 'object' ? Object.fromEntries(Object.entries(source.headings).filter(([k, v]) => defaultOrder.includes(k as SectionKey) && typeof v === 'string').map(([k, v]) => [k, (v as string).slice(0, 80)])) : {};
  return { ...defaults,
    templateId: typeof source.templateId === 'string' ? source.templateId.slice(0, 100) : defaults.templateId,
    pageSize: source.pageSize === 'Letter' ? 'Letter' : 'A4', fontFamily: fonts.includes(source.fontFamily as string) ? source.fontFamily as string : defaults.fontFamily,
    fontSize: number('fontSize', 8, 16, defaults.fontSize), margin: number('margin', 5, 40, defaults.margin), accent: color('accent', defaults.accent), textColor: color('textColor', defaults.textColor),
    layout: source.layout === 'two-column' || source.layout === 'sidebar' ? source.layout : 'single',
    lineHeight: number('lineHeight', 1, 2, defaults.lineHeight), sectionSpacing: number('sectionSpacing', 0.3, 3, defaults.sectionSpacing),
    headerStyle: source.headerStyle === 'center' || source.headerStyle === 'banner' ? source.headerStyle : 'left', headingStyle: source.headingStyle === 'plain' || source.headingStyle === 'band' ? source.headingStyle : 'line',
    order: [...order, ...defaultOrder.filter(k => !order.includes(k))], hidden: keys(source.hidden), pageBreaks: keys(source.pageBreaks), headings,
  };
}

export const newItem = (): Item => ({ id: crypto.randomUUID() });

