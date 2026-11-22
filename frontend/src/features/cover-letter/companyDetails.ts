export interface CompanyDetails {
  companyName: string;
  jobTitle: string;
  hiringManager: string;
  companyAddress: string;
  jobDescription: string;
}

export const EMPTY_COMPANY_DETAILS: CompanyDetails = {
  companyName: '',
  jobTitle: '',
  hiringManager: '',
  companyAddress: '',
  jobDescription: '',
};

export const COMPANY_DETAILS_FILE = 'company-details.json';

export function normalizeCompanyDetails(raw: unknown): CompanyDetails {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_COMPANY_DETAILS };
  const obj = raw as Record<string, unknown>;
  return {
    companyName: typeof obj.companyName === 'string' ? obj.companyName : '',
    jobTitle: typeof obj.jobTitle === 'string' ? obj.jobTitle : '',
    hiringManager: typeof obj.hiringManager === 'string' ? obj.hiringManager : '',
    companyAddress: typeof obj.companyAddress === 'string' ? obj.companyAddress : '',
    jobDescription: typeof obj.jobDescription === 'string' ? obj.jobDescription : '',
  };
}

export function hasCompanyDetails(details: CompanyDetails): boolean {
  return Boolean(
    details.companyName.trim() ||
      details.jobTitle.trim() ||
      details.hiringManager.trim() ||
      details.companyAddress.trim() ||
      details.jobDescription.trim()
  );
}

export function buildCompanyDetailsJson(details: CompanyDetails): string {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return JSON.stringify(
    {
      companyName: details.companyName.trim(),
      jobTitle: details.jobTitle.trim(),
      hiringManager: details.hiringManager.trim() || 'Hiring Manager',
      companyAddress: details.companyAddress.trim(),
      jobDescription: details.jobDescription.trim(),
      date: today,
    },
    null,
    2
  );
}

function findEntryCodeFile(files: Record<string, string>): string | null {
  const preferred = ['letter.jsx', 'App.jsx', 'main.jsx', 'index.jsx', 'CoverLetter.jsx', 'index.html'];
  for (const name of preferred) {
    if (Object.prototype.hasOwnProperty.call(files, name)) return name;
  }
  const anyCode = Object.keys(files).find((k) => /\.(jsx|tsx|js|html)$/i.test(k));
  return anyCode ?? null;
}

function escapeJsxText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildStarterCoverLetter(files: Record<string, string>): string {
  let candidateName = 'Your Name';
  let candidateContact = 'your.email@example.com | +1 (555) 000-0000';
  let candidateRole = 'Software Engineer';

  const profileRaw = files['career-profile.json'] || files['cv-import.json'];
  if (profileRaw) {
    try {
      const parsed = JSON.parse(profileRaw) as Record<string, any>;
      const personal = parsed.personal || {};
      const fullName = [personal.first_name, personal.last_name].filter(Boolean).join(' ').trim() || personal.name;
      if (fullName) candidateName = fullName;
      const contactParts = [personal.email, personal.phone, personal.location].filter(Boolean);
      if (contactParts.length) candidateContact = contactParts.join(' | ');
      if (personal.professional_title) candidateRole = personal.professional_title;
    } catch {
      // Fall back to starter defaults if imported JSON is invalid.
    }
  }

  return `import React from "react";
import company from "./company-details.json";
import "./styles.css";

export default function CoverLetter() {
  const recipient = company.hiringManager || "Hiring Manager";
  return (
    <article className="cl-page">
      <header className="cl-header">
        <h1>${escapeJsxText(candidateName)}</h1>
        <p className="cl-subtitle">${escapeJsxText(candidateRole)}</p>
        <p className="cl-contact">${escapeJsxText(candidateContact)}</p>
      </header>

      <section className="cl-recipient" data-auto-company="true">
        <p className="cl-date">{company.date}</p>
        {company.hiringManager && <p><strong>{company.hiringManager}</strong></p>}
        {company.companyName && <p><strong>{company.companyName}</strong></p>}
        {company.companyAddress && <p>{company.companyAddress}</p>}
        {company.jobTitle && <p className="cl-subject"><strong>Re: Application for {company.jobTitle}</strong></p>}
      </section>

      <p>Dear {recipient},</p>

      <p>
        I am writing to express my strong interest in the{" "}
        <strong>{company.jobTitle || "open"}</strong> position at{" "}
        <strong>{company.companyName || "your organization"}</strong>. With my background and
        hands-on experience, I am confident I can contribute immediately to your team.
      </p>

      <p>
        Throughout my career, I have delivered reliable, user-focused solutions and collaborated
        across teams to meet ambitious product goals. I welcome the opportunity to discuss how my
        skills align with the needs at {company.companyName || "your company"}.
      </p>

      <p>Thank you for your time and consideration.</p>

      <p className="cl-signoff">
        Sincerely,<br />
        <strong>${escapeJsxText(candidateName)}</strong>
      </p>
    </article>
  );
}
`;
}

const STARTER_COVER_LETTER_CSS = `.cl-page {
  font-family: "Georgia", "Times New Roman", serif;
  color: #1e293b;
  line-height: 1.55;
  padding: 14mm 16mm;
  font-size: 11pt;
}
.cl-header {
  border-bottom: 1.5px solid #0f172a;
  padding-bottom: 10px;
  margin-bottom: 16px;
}
.cl-header h1 {
  margin: 0;
  font-size: 20pt;
  letter-spacing: 0.02em;
}
.cl-subtitle {
  margin: 2px 0 4px;
  font-weight: 600;
  color: #334155;
}
.cl-contact {
  margin: 0;
  font-size: 9.5pt;
  color: #475569;
}
.cl-recipient {
  margin-bottom: 16px;
}
.cl-recipient p {
  margin: 2px 0;
}
.cl-date {
  margin-bottom: 8px !important;
  color: #475569;
}
.cl-subject {
  margin-top: 10px !important;
}
.cl-signoff {
  margin-top: 20px;
}
`;

function replaceAllLiteral(text: string, search: string, replacement: string): { text: string; changed: boolean } {
  if (!search || search === replacement || !text.includes(search)) {
    return { text, changed: false };
  }
  return { text: text.split(search).join(replacement), changed: true };
}

function buildAutoCompanyMarkup(details: CompanyDetails, isHtml: boolean): string {
  const attr = isHtml ? 'class' : 'className';
  const lines = [
    details.hiringManager.trim() ? `<p><strong>${escapeJsxText(details.hiringManager.trim())}</strong></p>` : '',
    details.companyName.trim() ? `<p><strong>${escapeJsxText(details.companyName.trim())}</strong></p>` : '',
    details.companyAddress.trim() ? `<p>${escapeJsxText(details.companyAddress.trim())}</p>` : '',
    details.jobTitle.trim() ? `<p><strong>Re: Application for ${escapeJsxText(details.jobTitle.trim())}</strong></p>` : '',
  ].filter(Boolean);

  return `<section ${attr}="cl-recipient" data-auto-company="true">\n  ${lines.join('\n  ')}\n</section>`;
}

/**
 * Saves `company-details.json` and auto-fills company information into the cover letter code.
 */
export function applyCompanyDetailsToWorkspace(
  files: Record<string, string>,
  details: CompanyDetails,
  previousDetails?: CompanyDetails | null
): { files: Record<string, string>; targetFile: string; summary: string } {
  const nextFiles: Record<string, string> = {
    ...files,
    [COMPANY_DETAILS_FILE]: buildCompanyDetailsJson(details),
  };

  const entryFile = findEntryCodeFile(files);
  if (!entryFile) {
    nextFiles['letter.jsx'] = buildStarterCoverLetter(nextFiles);
    if (!nextFiles['styles.css']) {
      nextFiles['styles.css'] = STARTER_COVER_LETTER_CSS;
    }
    return {
      files: nextFiles,
      targetFile: 'letter.jsx',
      summary: 'Created letter.jsx and company-details.json pre-filled with your company details.',
    };
  }

  let code = files[entryFile] ?? '';
  const usesCompanyJson = /company-details\.json/.test(code);
  if (usesCompanyJson) {
    return {
      files: nextFiles,
      targetFile: entryFile,
      summary: `Updated ${COMPANY_DETAILS_FILE}; ${entryFile} reads from it automatically.`,
    };
  }

  let changed = false;
  const companyName = details.companyName.trim();
  const jobTitle = details.jobTitle.trim();
  const hiringManager = details.hiringManager.trim();
  const companyAddress = details.companyAddress.trim();

  // 1. Replace common template placeholders
  const placeholders: Array<[RegExp, string]> = [
    [/\{\{\s*companyName\s*\}\}|\[Company Name\]/gi, companyName],
    [/\{\{\s*jobTitle\s*\}\}|\[Job Title\]|\[Position\]/gi, jobTitle],
    [/\{\{\s*hiringManager\s*\}\}|\[Hiring Manager(?:\s+Name)?\]/gi, hiringManager || 'Hiring Manager'],
    [/\{\{\s*companyAddress\s*\}\}|\[Company Address\]/gi, companyAddress],
  ];
  for (const [pattern, replacement] of placeholders) {
    if (replacement && pattern.test(code)) {
      code = code.replace(pattern, replacement);
      changed = true;
    }
  }

  // 2. Replace previously applied company details when the user edits & re-applies
  if (previousDetails) {
    const swaps: Array<[string, string]> = [
      [previousDetails.companyName.trim(), companyName],
      [previousDetails.jobTitle.trim(), jobTitle],
      [previousDetails.hiringManager.trim(), hiringManager || 'Hiring Manager'],
      [previousDetails.companyAddress.trim(), companyAddress],
    ];
    for (const [oldVal, newVal] of swaps) {
      if (oldVal && newVal && oldVal !== newVal) {
        const res = replaceAllLiteral(code, oldVal, newVal);
        if (res.changed) {
          code = res.text;
          changed = true;
        }
      }
    }
  }

  // 3. Personalize generic salutation if a hiring manager name is given
  if (hiringManager && /Dear Hiring Manager,/i.test(code)) {
    code = code.replace(/Dear Hiring Manager,/gi, `Dear ${hiringManager},`);
    changed = true;
  }

  // 4. Insert or update an auto-managed recipient block if not already present
  const isHtml = /\.html$/i.test(entryFile);
  const autoBlockRegex = /<section\b[^>]*data-auto-company="true"[^>]*>[\s\S]*?<\/section>/i;
  const hasCompanyAlready = Boolean(companyName && code.includes(companyName));
  if (companyName || jobTitle || hiringManager || companyAddress) {
    const markup = buildAutoCompanyMarkup(details, isHtml);
    if (autoBlockRegex.test(code)) {
      code = code.replace(autoBlockRegex, markup);
      changed = true;
    } else if (!hasCompanyAlready) {
      if (/<\/header>/i.test(code)) {
        code = code.replace(/<\/header>/i, `</header>\n      ${markup}`);
        changed = true;
      } else if (/<article\b[^>]*>/i.test(code)) {
        code = code.replace(/<article\b[^>]*>/i, (m) => `${m}\n      ${markup}`);
        changed = true;
      }
    }
  }

  nextFiles[entryFile] = code;
  return {
    files: nextFiles,
    targetFile: entryFile,
    summary: changed
      ? `Auto-filled company details into ${entryFile} and updated ${COMPANY_DETAILS_FILE}.`
      : `Saved ${COMPANY_DETAILS_FILE}.`,
  };
}

