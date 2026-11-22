/**
 * Shared Career Profile → document import helpers.
 *
 * The Career Profile lives in the database (`/api/career-profile/`). Importing it into a CV or cover
 * letter writes an independent, editable COPY into the project as a JSON file. Users can edit that copy
 * freely and the original Career Profile is never touched. Refreshing replaces the copy with the latest
 * profile (after warning about local edits).
 */
import { compileAndRenderCvWorkspace } from './cvRuntime';
import { parseRenderedCvDom } from './cvAnalysis';

export const CAREER_PROFILE_FILE = 'career-profile.json';
export const CAREER_PROFILE_BACKUP_FILE = 'career-profile.previous.json';
export const CV_IMPORT_FILE = 'cv-import.json';

export const CAREER_SECTION_KEYS = [
  'personal',
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
] as const;
export type CareerSectionKey = (typeof CAREER_SECTION_KEYS)[number];

export const CAREER_SECTION_LABELS: Record<CareerSectionKey, string> = {
  personal: 'Personal details',
  summary: 'Professional summary',
  experience: 'Work experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
};

export interface ExperienceItem {
  company: string;
  role: string;
  location: string;
  start_date: string;
  end_date: string;
  current: boolean;
  description: string;
}
export interface EducationItem {
  institution: string;
  degree: string;
  field: string;
  start_date: string;
  end_date: string;
  details: string;
}
export interface ProjectItem {
  name: string;
  link: string;
  technologies: string;
  description: string;
}
export interface CertificationItem {
  name: string;
  issuer: string;
  date: string;
}

export interface CareerProfileData {
  personal: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    location: string;
    professional_title: string;
    linkedin: string;
    github: string;
    portfolio: string;
    bio: string;
  };
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  revision: number;
  updated_at: string | null;
  percent: number;
  sections: { key: string; label: string; complete: boolean }[];
}

export interface CareerImportMeta {
  source: 'career-profile';
  file: string;
  revision: number;
  importedAt: string;
  sections: CareerSectionKey[];
  sectionHashes: Record<string, string>;
  contentHash: string;
}

export interface CvImportMeta {
  source: 'cv';
  file: string;
  projectId: string;
  title: string;
  importedAt: string;
  sourceUpdatedAt: string;
  contentHash: string;
}

export interface DocumentImports {
  career_profile?: CareerImportMeta;
  cv?: CvImportMeta;
}

export interface CareerImportResult {
  files: Record<string, string>;
  imports: DocumentImports;
  message: string;
  openFile: string;
}

/** Small stable string hash (djb2). Used only to detect "has this text changed?". */
export function simpleHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function bulletsFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•·▪●]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

/** The camelCase, JS-friendly shape of one section as written to the imported file. */
export function sectionSnapshot(profile: CareerProfileData, key: CareerSectionKey): unknown {
  switch (key) {
    case 'personal': {
      const p = profile.personal;
      return {
        fullName: `${p.first_name} ${p.last_name}`.trim(),
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        phone: p.phone,
        location: p.location,
        professionalTitle: p.professional_title,
        linkedin: p.linkedin,
        github: p.github,
        portfolio: p.portfolio,
        bio: p.bio,
      };
    }
    case 'summary':
      return profile.summary;
    case 'experience':
      return profile.experience.map((item) => ({
        company: item.company,
        role: item.role,
        location: item.location,
        startDate: item.start_date,
        endDate: item.current ? 'Present' : item.end_date,
        current: item.current,
        description: item.description,
        bullets: bulletsFromText(item.description),
      }));
    case 'education':
      return profile.education.map((item) => ({
        institution: item.institution,
        degree: item.degree,
        field: item.field,
        startDate: item.start_date,
        endDate: item.end_date,
        details: item.details,
      }));
    case 'skills':
      return [...profile.skills];
    case 'projects':
      return profile.projects.map((item) => ({
        name: item.name,
        link: item.link,
        technologies: item.technologies
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        description: item.description,
        bullets: bulletsFromText(item.description),
      }));
    case 'certifications':
      return profile.certifications.map((item) => ({ name: item.name, issuer: item.issuer, date: item.date }));
  }
}

/** True when a section has any content worth importing. */
export function sectionHasContent(profile: CareerProfileData, key: CareerSectionKey): boolean {
  const value = sectionSnapshot(profile, key);
  if (key === 'personal') {
    const p = value as Record<string, string>;
    return Boolean(p.fullName || p.phone || p.location || p.professionalTitle || p.linkedin || p.github || p.portfolio);
  }
  if (typeof value === 'string') return value.trim().length > 0;
  return Array.isArray(value) && value.length > 0;
}

export function countSectionItems(profile: CareerProfileData, key: CareerSectionKey): number {
  const value = sectionSnapshot(profile, key);
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') return value.trim() ? 1 : 0;
  return sectionHasContent(profile, key) ? 1 : 0;
}

export function hashSection(profile: CareerProfileData, key: CareerSectionKey): string {
  return simpleHash(JSON.stringify(sectionSnapshot(profile, key)));
}

/** Build the JSON file that is written into the CV / cover letter project. */
export function buildCareerProfileImport(
  profile: CareerProfileData,
  sections: CareerSectionKey[],
  importedAt: string = new Date().toISOString()
): { content: string; meta: CareerImportMeta } {
  const body: Record<string, unknown> = {
    _meta: {
      source: 'career-profile',
      revision: profile.revision,
      importedAt,
      note: 'Editable copy. Changing this file does not change your Career Profile.',
    },
  };
  const sectionHashes: Record<string, string> = {};
  for (const key of CAREER_SECTION_KEYS) {
    if (!sections.includes(key)) continue;
    body[key] = sectionSnapshot(profile, key);
    sectionHashes[key] = hashSection(profile, key);
  }
  const content = `${JSON.stringify(body, null, 2)}\n`;
  return {
    content,
    meta: {
      source: 'career-profile',
      file: CAREER_PROFILE_FILE,
      revision: profile.revision,
      importedAt,
      sections,
      sectionHashes,
      contentHash: simpleHash(content),
    },
  };
}

/** Which of the imported sections differ between the live Career Profile and what was imported? */
export function changedSectionsSinceImport(profile: CareerProfileData, meta: CareerImportMeta): CareerSectionKey[] {
  return meta.sections.filter((key) => hashSection(profile, key) !== meta.sectionHashes[key]);
}

/** Has the user edited the imported file since it was written? */
export function importedFileWasEdited(files: Record<string, string>, file: string, contentHash: string): boolean {
  const current = files[file];
  return typeof current === 'string' && simpleHash(current) !== contentHash;
}

// ---------------------------------------------------------------------------
// Import from an existing CV (used by the Cover Letter Builder)
// ---------------------------------------------------------------------------
const CV_SECTION_PATTERNS: { key: 'summary' | 'experience' | 'education' | 'skills' | 'projects'; regex: RegExp }[] = [
  { key: 'summary', regex: /^(professional\s+summary|summary|profile|objective|about\s+me)$/i },
  { key: 'experience', regex: /^(professional\s+experience|work\s+experience|experience|employment(\s+history)?)$/i },
  { key: 'education', regex: /^(education(\s*(&|and)\s*training)?|academic\s+background)$/i },
  { key: 'skills', regex: /^(technical\s+skills|skills|key\s+skills|core\s+competencies)$/i },
  { key: 'projects', regex: /^(projects|key\s+projects|personal\s+projects)$/i },
];

/** Extract reusable facts from the RENDERED text of a CV project (never from its source code). */
export function extractCvImport(
  files: Record<string, string>,
  source: { projectId: string; title: string; updatedAt: string },
  importedAt: string = new Date().toISOString()
): { content: string; meta: CvImportMeta } {
  const compiled = compileAndRenderCvWorkspace(files);
  const { lines, headings, fullText } = parseRenderedCvDom(compiled.html);

  const headingSet = new Set(headings.map((h) => h.text.trim().toLowerCase()));
  const sections: Record<string, string[]> = { summary: [], experience: [], education: [], skills: [], projects: [] };
  let current: keyof typeof sections | null = null;
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    const pattern = text.length <= 45 && headingSet.has(text.toLowerCase())
      ? CV_SECTION_PATTERNS.find((p) => p.regex.test(text))
      : undefined;
    if (pattern) {
      current = pattern.key;
      continue;
    }
    if (current) sections[current].push(text);
  }

  const email = fullText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const phone = fullText.match(/\+?\d[\d\s().-]{7,}\d/)?.[0]?.trim() ?? '';
  const links = Array.from(
    new Set((fullText.match(/(?:https?:\/\/|www\.)[^\s|,]+|(?:linkedin\.com|github\.com)\/[^\s|,]+/gi) ?? []).map((l) => l.trim()))
  );
  const name = headings.find((h) => h.level === 1)?.text ?? '';
  const skillTokens = sections.skills
    .flatMap((line) => line.replace(/^[^:]{1,40}:\s*/, '').split(/[,;|•·]/))
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 60);

  const body = {
    _meta: {
      source: 'cv',
      projectId: source.projectId,
      title: source.title,
      importedAt,
      note: 'Extracted from the rendered CV text. Editable copy; the original CV is not changed.',
    },
    name,
    email,
    phone,
    links,
    summary: sections.summary.join(' '),
    skills: Array.from(new Set(skillTokens)),
    experience: sections.experience,
    education: sections.education,
    projects: sections.projects,
  };
  const content = `${JSON.stringify(body, null, 2)}\n`;
  return {
    content,
    meta: {
      source: 'cv',
      file: CV_IMPORT_FILE,
      projectId: source.projectId,
      title: source.title,
      importedAt,
      sourceUpdatedAt: source.updatedAt,
      contentHash: simpleHash(content),
    },
  };
}

/** Short hint shown after a successful import. */
export function usageHint(file: string): string {
  const variable = file === CV_IMPORT_FILE ? 'cv' : 'profile';
  return `Use it in your code: import ${variable} from './${file}';`;
}

