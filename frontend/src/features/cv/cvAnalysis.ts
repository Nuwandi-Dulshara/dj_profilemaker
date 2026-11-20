/**
 * Step 7: CV Analysis Tools (ATS Checker, Job Matcher, Grammar Checker)
 * All analyses operate strictly on the saved, rendered CV HTML/CSS (never raw React source code).
 */

export interface AtsIssueItem {
  id: string;
  category: string;
  status: 'Pass' | 'Warning' | 'Issue Found';
  issue: string;
  explanation: string;
  recommendation: string;
}

export interface AtsAnalysisResult {
  score: number;
  wordCount: number;
  detectedSections: string[];
  missingSections: string[];
  contactInfo: {
    email: boolean;
    phone: boolean;
    location: boolean;
    profileLink: boolean;
  };
  items: AtsIssueItem[];
  disclaimer: string;
}

export type JobMatchStatus = 'Matched' | 'Partial Match' | 'Missing';

export interface JobRequirementComparison {
  requirement: string;
  cvInformation: string;
  status: JobMatchStatus;
  duplicateCount: number;
}

export interface JobMatchAnalysisResult {
  matchPercentage: number;
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  duplicateCount: number;
  comparisons: JobRequirementComparison[];
  missingKeywords: string[];
  recommendations: string[];
}

export type GrammarIssueType =
  | 'Spelling Mistake'
  | 'Grammar Mistake'
  | 'Sentence Structure'
  | 'Repeated Words'
  | 'Unclear Description'
  | 'Capitalization & Punctuation'
  | 'Weak Action Verb'
  | 'Unprofessional Wording';

export interface GrammarIssueItem {
  id: string;
  originalText: string;
  issueType: GrammarIssueType;
  suggestedCorrection: string;
  explanation: string;
}

export interface GrammarAnalysisResult {
  totalIssues: number;
  checkedSentences: number;
  issues: GrammarIssueItem[];
}

/**
 * Parse rendered CV HTML into a detached DOM element and extract structured text, headings, and lines.
 */
export function parseRenderedCvDom(renderedHtml: string): {
  doc: HTMLElement;
  fullText: string;
  lines: string[];
  headings: { level: number; text: string }[];
} {
  const container = document.createElement('div');
  container.innerHTML = renderedHtml || '';

  const headings: { level: number; text: string }[] = [];
  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const level = Number(el.tagName.slice(1)) || 2;
    const text = (el.textContent || '').trim();
    if (text) headings.push({ level, text });
  });

  // Extract clean text blocks from block-level elements
  const blockTexts: string[] = [];
  const blockNodes = container.querySelectorAll('h1, h2, h3, h4, p, li, td, th, div, section, header, article');
  if (blockNodes.length > 0) {
    blockNodes.forEach((node) => {
      // Only take leaf-like blocks or blocks with direct text to avoid duplicating parent container text
      const hasChildBlocks = Array.from(node.children).some((c) =>
        /^(h[1-6]|p|li|ul|ol|table|tr|td|th|div|section|article|header)$/i.test(c.tagName)
      );
      if (!hasChildBlocks) {
        const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) blockTexts.push(t);
      } else {
        // Also capture direct text nodes inside mixed containers
        const directText = Array.from(node.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => (n.textContent || '').trim())
          .filter(Boolean)
          .join(' ');
        if (directText) blockTexts.push(directText);
      }
    });
  }

  const rawText = (container.textContent || '').replace(/\s+/g, ' ').trim();
  const lines =
    blockTexts.length > 0
      ? Array.from(new Set(blockTexts))
      : rawText
          .split(/(?<=[.!?])\s+|\n+/)
          .map((s) => s.trim())
          .filter(Boolean);

  return {
    doc: container,
    fullText: lines.join('\n') || rawText,
    lines,
    headings,
  };
}

/**
 * 7.1 ATS Checker: Analyze the saved, rendered CV HTML and CSS across all 8 ATS compatibility checks.
 */
export function runAtsCheck(renderedHtml: string, renderedCss: string): AtsAnalysisResult {
  const { doc, fullText, headings } = parseRenderedCvDom(renderedHtml);
  const words = fullText
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const wordCount = words.length;
  const items: AtsIssueItem[] = [];

  // 1. Readable text and standard section headings
  const standardSections = [
    { name: 'Summary / Profile', regex: /\b(summary|profile|objective|about\s+me)\b/i },
    { name: 'Work Experience', regex: /\b(experience|employment|work\s+history|career\s+history)\b/i },
    { name: 'Education', regex: /\b(education|academic|qualifications|degrees?)\b/i },
    { name: 'Skills', regex: /\b(skills|technologies|technical\s+skills|competencies|expertise)\b/i },
    { name: 'Projects', regex: /\b(projects|key\s+projects|portfolio)\b/i },
    { name: 'Certifications', regex: /\b(certifications?|licenses?|awards?)\b/i },
  ];

  const headingTexts = headings.map((h) => h.text).join(' \n ');
  const detectedSections: string[] = [];
  const missingSections: string[] = [];

  for (const sec of standardSections) {
    if (sec.regex.test(headingTexts) || sec.regex.test(fullText)) {
      detectedSections.push(sec.name);
    } else if (['Summary / Profile', 'Work Experience', 'Education', 'Skills'].includes(sec.name)) {
      missingSections.push(sec.name);
    }
  }

  const hasSemanticHeadings = headings.some((h) => h.level === 2 || h.level === 3);
  if (wordCount < 40 || !hasSemanticHeadings) {
    items.push({
      id: 'readable-text-headings',
      category: 'Readable Text & Standard Section Headings',
      status: wordCount === 0 ? 'Issue Found' : 'Warning',
      issue:
        wordCount < 40
          ? `Low extractable text volume (${wordCount} words detected) or missing semantic headings.`
          : 'CV content lacks semantic <h2>/<h3> section headings.',
      explanation:
        'Applicant Tracking Systems rely on standard HTML/document heading tags and sufficient plain text to segment your career history accurately.',
      recommendation:
        'Use standard headings such as "Summary", "Work Experience", "Education", and "Skills" inside semantic <h2> tags with clear descriptive text.',
    });
  } else {
    items.push({
      id: 'readable-text-headings',
      category: 'Readable Text & Standard Section Headings',
      status: 'Pass',
      issue: `Readable text (${wordCount} words) and semantic headings detected.`,
      explanation:
        'Your rendered CV provides extractable text and recognizable section headings that ATS parsers can index.',
      recommendation: 'Keep section titles clear and conventional (e.g., Work Experience, Education, Skills).',
    });
  }

  // 2. Missing contact information
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(fullText);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(fullText);
  const hasLocation =
    /\b(street|road|ave|city|country|london|new york|colombo|sri lanka|usa|uk|canada|australia|remote|[A-Z][a-z]+,\s*[A-Z]{2,})\b/i.test(
      fullText
    );
  const hasProfileLink =
    /\b(linkedin\.com|github\.com|portfolio|https?:\/\/)/i.test(fullText) ||
    doc.querySelectorAll('a[href]').length > 0;

  const missingContacts: string[] = [];
  if (!hasEmail) missingContacts.push('Email address');
  if (!hasPhone) missingContacts.push('Phone number');
  if (!hasLocation) missingContacts.push('Location / City');
  if (!hasProfileLink) missingContacts.push('LinkedIn / GitHub / Portfolio link');

  if (missingContacts.length > 0) {
    items.push({
      id: 'contact-information',
      category: 'Contact Information',
      status: !hasEmail || !hasPhone ? 'Issue Found' : 'Warning',
      issue: `Missing contact details: ${missingContacts.join(', ')}.`,
      explanation:
        'ATS parsers extract candidate contact fields from the header of the rendered document. Missing email or phone fields can prevent recruiter follow-up.',
      recommendation: `Add ${missingContacts.join(', ')} as plain selectable text in your CV header.`,
    });
  } else {
    items.push({
      id: 'contact-information',
      category: 'Contact Information',
      status: 'Pass',
      issue: 'Email, phone number, location, and profile links are present.',
      explanation: 'All key contact fields are present in plain readable text.',
      recommendation: 'Ensure contact details remain in the top body of the CV rather than inside an image.',
    });
  }

  // 3. Complex tables and multi-column layouts
  const tableCount = doc.querySelectorAll('table').length;
  const usesGridOrMultiColCss =
    /\b(grid-template-columns|column-count|columns\s*:)\b/i.test(renderedCss) ||
    /\b(grid-template-columns|column-count)\b/i.test(renderedHtml);

  if (tableCount > 0 || usesGridOrMultiColCss) {
    items.push({
      id: 'tables-multicolumn',
      category: 'Tables & Multi-Column Layouts',
      status: 'Warning',
      issue:
        tableCount > 0 && usesGridOrMultiColCss
          ? `Detected ${tableCount} HTML table(s) and multi-column CSS Grid/column styles.`
          : tableCount > 0
          ? `Detected ${tableCount} table element(s) in the rendered CV.`
          : 'Detected multi-column CSS layout (grid-template-columns / column-count).',
      explanation:
        'Older ATS parsers often read multi-column layouts and tables left-to-right across the page rather than column-by-column, merging unrelated lines.',
      recommendation:
        'Prefer a single-column top-to-bottom layout for core sections like Work Experience and Education, and avoid nested layout tables.',
    });
  } else {
    items.push({
      id: 'tables-multicolumn',
      category: 'Tables & Multi-Column Layouts',
      status: 'Pass',
      issue: 'No complex layout tables or multi-column text traps detected.',
      explanation: 'Single-column linear flow ensures reliable top-to-bottom text extraction across ATS platforms.',
      recommendation: 'Continue using linear block elements (<section>, <div>, <ul>) for CV sections.',
    });
  }

  // 4. Images or graphics containing important text
  const images = Array.from(doc.querySelectorAll('img'));
  const svgs = Array.from(doc.querySelectorAll('svg, canvas'));
  const imagesMissingAlt = images.filter((img) => !(img.getAttribute('alt') || '').trim());

  if (images.length > 0 || svgs.length > 0) {
    items.push({
      id: 'images-graphics',
      category: 'Images & Graphics',
      status: imagesMissingAlt.length > 0 ? 'Issue Found' : 'Warning',
      issue:
        imagesMissingAlt.length > 0
          ? `Found ${images.length} image(s) (${imagesMissingAlt.length} missing alt text) and ${svgs.length} graphic element(s).`
          : `Found ${images.length} image(s) and ${svgs.length} SVG/canvas graphic element(s).`,
      explanation:
        'ATS parsers ignore text embedded inside images, SVG charts, skill bars, or icons, and may skip decorative graphics altogether.',
      recommendation:
        'Never place contact info, skill names, or work history inside images or SVG skill bars. Always write critical details as standard text and include descriptive alt attributes.',
    });
  } else {
    items.push({
      id: 'images-graphics',
      category: 'Images & Graphics',
      status: 'Pass',
      issue: 'No images or graphic elements hiding CV text.',
      explanation: 'All content in the rendered CV is represented as direct selectable text.',
      recommendation: 'If you upload a profile photo, keep all text outside the image.',
    });
  }

  // 5. Incorrect reading order
  const usesAbsoluteOrFloat =
    /\b(position\s*:\s*(?:absolute|fixed)|float\s*:\s*(?:left|right))\b/i.test(renderedCss) ||
    /\b(position\s*:\s*(?:absolute|fixed)|float\s*:\s*(?:left|right))\b/i.test(renderedHtml);
  let outOfOrderHeadings = false;
  let lastLevel = 0;
  for (const h of headings) {
    if (lastLevel > 0 && h.level > lastLevel + 1) {
      outOfOrderHeadings = true;
    }
    lastLevel = h.level;
  }
  const firstHeadingNotH1 = headings.length > 0 && headings[0].level !== 1;

  if (usesAbsoluteOrFloat || outOfOrderHeadings || firstHeadingNotH1) {
    items.push({
      id: 'reading-order',
      category: 'Document Reading Order',
      status: usesAbsoluteOrFloat ? 'Issue Found' : 'Warning',
      issue: usesAbsoluteOrFloat
        ? 'Absolute/fixed positioning or CSS floats detected, which can alter visual vs. DOM reading order.'
        : 'Heading hierarchy does not follow a strict H1 -> H2 -> H3 order.',
      explanation:
        'ATS parsers read text strictly in DOM order. Absolute positioning, floats, or skipped heading levels can cause job titles and dates to associate with the wrong employer.',
      recommendation:
        'Structure your CV sequentially in DOM order: start with <h1> for your name, <h2> for section titles, and <h3> for role/degree titles without CSS absolute positioning.',
    });
  } else {
    items.push({
      id: 'reading-order',
      category: 'Document Reading Order',
      status: 'Pass',
      issue: 'Sequential DOM order and proper heading hierarchy (H1 -> H2 -> H3).',
      explanation: 'Visual order matches the underlying document structure.',
      recommendation: 'Keep job titles, company names, and dates grouped together in sequential order.',
    });
  }

  // 6. Unusual formatting
  const hasUnusualSymbols = /[★☆✦✧❖➤➢✓✔✗✘⚡🔥🚀💡🎯]/u.test(fullText);
  const hasTinyFont = /\bfont-size\s*:\s*([0-9](\.\d+)?)px\b/i.test(renderedCss + renderedHtml);
  const allCapsLines = fullText
    .split('\n')
    .filter((l) => l.length > 25 && l === l.toUpperCase() && /[A-Z]/.test(l));

  if (hasUnusualSymbols || hasTinyFont || allCapsLines.length > 0) {
    items.push({
      id: 'unusual-formatting',
      category: 'Formatting & Typography',
      status: 'Warning',
      issue: [
        hasUnusualSymbols ? 'Special decorative Unicode symbols/emojis detected' : '',
        hasTinyFont ? 'Font size smaller than 10px detected' : '',
        allCapsLines.length > 0 ? 'Long ALL-CAPS sentences detected' : '',
      ]
        .filter(Boolean)
        .join('; '),
      explanation:
        'Decorative symbols, emojis, tiny font sizes, and long all-caps blocks can turn into garbled characters or fail tokenization in ATS text extractors.',
      recommendation:
        'Use standard bullet lists (<ul><li>), readable font sizes (10pt–12pt for body text), and standard title/sentence case.',
    });
  } else {
    items.push({
      id: 'unusual-formatting',
      category: 'Formatting & Typography',
      status: 'Pass',
      issue: 'Clean typography and standard character formatting.',
      explanation: 'No problematic special symbols, emojis, or illegible font sizes were found.',
      recommendation: 'Use standard system or web-safe fonts such as Inter, Arial, Calibri, or Georgia.',
    });
  }

  // 7. Missing important CV sections
  if (missingSections.length > 0) {
    items.push({
      id: 'missing-sections',
      category: 'Important CV Sections',
      status: 'Issue Found',
      issue: `Missing core CV section(s): ${missingSections.join(', ')}.`,
      explanation:
        'Most ATS systems map candidate profiles into structured fields for Summary, Work Experience, Education, and Skills.',
      recommendation: `Add dedicated section headings and content for: ${missingSections.join(', ')}.`,
    });
  } else {
    items.push({
      id: 'missing-sections',
      category: 'Important CV Sections',
      status: 'Pass',
      issue: 'All core CV sections (Summary, Work Experience, Education, Skills) are present.',
      explanation: `Detected sections: ${detectedSections.join(', ')}.`,
      recommendation: 'Ensure each section contains dated entries and measurable achievements.',
    });
  }

  // 8. Potential problems with extracting text from exported PDF or DOCX
  const hasHiddenText =
    /\b(opacity\s*:\s*0|visibility\s*:\s*hidden|display\s*:\s*none|font-size\s*:\s*0)\b/i.test(
      renderedCss + renderedHtml
    );
  const deepNesting = doc.querySelectorAll('div div div div div div').length > 0;

  if (hasHiddenText || deepNesting || wordCount === 0) {
    items.push({
      id: 'pdf-docx-extraction',
      category: 'PDF & DOCX Text Extraction Readiness',
      status: wordCount === 0 || hasHiddenText ? 'Issue Found' : 'Warning',
      issue:
        wordCount === 0
          ? 'No rendered text available to extract into PDF or DOCX.'
          : hasHiddenText
          ? 'Hidden CSS rules (display:none / opacity:0) detected in rendered output.'
          : 'Deeply nested DOM containers detected.',
      explanation:
        'Hidden elements, zero-opacity text, or deeply nested layout wrappers can cause missing paragraphs or broken line breaks when converted to PDF or DOCX.',
      recommendation:
        'Remove hidden text elements and keep your JSX markup flat and semantic (<header>, <section>, <h2>, <p>, <ul><li>).',
    });
  } else {
    items.push({
      id: 'pdf-docx-extraction',
      category: 'PDF & DOCX Text Extraction Readiness',
      status: 'Pass',
      issue: 'Rendered DOM structure is clean and ready for PDF and DOCX text extraction.',
      explanation:
        'Semantic HTML elements and visible text nodes allow both PDF print rendering and DOCX conversion to preserve text order.',
      recommendation: 'Review the exported PDF or DOCX whenever you add new custom CSS rules.',
    });
  }

  const passCount = items.filter((i) => i.status === 'Pass').length;
  const warningCount = items.filter((i) => i.status === 'Warning').length;
  const score = wordCount === 0 ? 0 : Math.round(((passCount + warningCount * 0.5) / items.length) * 100);

  return {
    score,
    wordCount,
    detectedSections,
    missingSections,
    contactInfo: {
      email: hasEmail,
      phone: hasPhone,
      location: hasLocation,
      profileLink: hasProfileLink,
    },
    items,
    disclaimer:
      'Disclaimer: This ATS Checker evaluates your saved, rendered CV against common Applicant Tracking System parsing rules and formatting best practices. It does not guarantee acceptance or ranking by any specific employer or ATS platform.',
  };
}

/**
 * Cover Letter ATS & Structure Checker: Analyze the saved, rendered Cover Letter HTML and CSS
 * for ATS compatibility, business letter structure, contact details, salutation, sign-off, and PDF/DOCX extraction.
 */
export function runCoverLetterAtsCheck(renderedHtml: string, renderedCss: string): AtsAnalysisResult {
  const { doc, fullText } = parseRenderedCvDom(renderedHtml);
  const words = fullText
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const wordCount = words.length;
  const items: AtsIssueItem[] = [];

  const letterElements = [
    { name: 'Salutation', regex: /\b(dear\s+[a-z0-9]|to\s+whom\s+it\s+may\s+concern|hiring\s+manager|recruitment\s+team|selection\s+committee)\b/i },
    { name: 'Opening Hook & Role', regex: /\b(apply|applying|application|position|role|opportunity|interest\s+in|writing\s+to)\b/i },
    { name: 'Value & Experience Body', regex: /\b(experience|developed|engineered|built|led|delivered|skills|project|team|impact|achieved)\b/i },
    { name: 'Sign-Off & Closing', regex: /\b(sincerely|regards|best\s+regards|kind\s+regards|respectfully|thank\s+you|yours\s+truly|cordially)\b/i },
  ];

  const detectedSections: string[] = [];
  const missingSections: string[] = [];
  for (const el of letterElements) {
    if (el.regex.test(fullText)) detectedSections.push(el.name);
    else missingSections.push(el.name);
  }

  // 1. Readable text and ideal cover letter length (100 - 500 words)
  if (wordCount < 60) {
    items.push({
      id: 'letter-readability-length',
      category: 'Readable Text & Cover Letter Length',
      status: wordCount === 0 ? 'Issue Found' : 'Warning',
      issue: `Low extractable text volume (${wordCount} words detected).`,
      explanation:
        'A compelling cover letter typically contains 180–400 words across 3–4 focused paragraphs that ATS systems and hiring managers can read quickly.',
      recommendation:
        'Write a clear opening paragraph stating the target role, 1–2 body paragraphs connecting your achievements to the company, and a concise closing paragraph.',
    });
  } else if (wordCount > 550) {
    items.push({
      id: 'letter-readability-length',
      category: 'Readable Text & Cover Letter Length',
      status: 'Warning',
      issue: `Cover letter is quite long (${wordCount} words).`,
      explanation:
        'Cover letters exceeding one A4 page (over ~450–500 words) may lose recruiter attention during initial screening.',
      recommendation: 'Trim repetitive sentences so your cover letter fits comfortably on a single A4 page.',
    });
  } else {
    items.push({
      id: 'letter-readability-length',
      category: 'Readable Text & Cover Letter Length',
      status: 'Pass',
      issue: `Readable cover letter length (${wordCount} words) detected.`,
      explanation: 'Your saved cover letter has an effective word count for both ATS indexing and human review.',
      recommendation: 'Keep paragraphs focused on 2–3 high-impact examples relevant to the target role.',
    });
  }

  // 2. Sender Contact Information
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(fullText);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(fullText);
  const hasLocation =
    /\b(street|road|ave|city|country|london|new york|colombo|sri lanka|usa|uk|canada|australia|remote|[A-Z][a-z]+,\s*[A-Z]{2,})\b/i.test(
      fullText
    );
  const hasProfileLink =
    /\b(linkedin\.com|github\.com|portfolio|https?:\/\/)/i.test(fullText) ||
    doc.querySelectorAll('a[href]').length > 0;

  const missingContacts: string[] = [];
  if (!hasEmail) missingContacts.push('Email address');
  if (!hasPhone) missingContacts.push('Phone number');
  if (!hasLocation) missingContacts.push('Location / City');
  if (!hasProfileLink) missingContacts.push('LinkedIn / Portfolio link');

  if (missingContacts.length > 0) {
    items.push({
      id: 'contact-information',
      category: 'Sender Contact Header',
      status: !hasEmail || !hasPhone ? 'Issue Found' : 'Warning',
      issue: `Missing sender contact details: ${missingContacts.join(', ')}.`,
      explanation:
        'Your cover letter header should match your CV header with complete contact information in plain selectable text.',
      recommendation: `Include ${missingContacts.join(', ')} at the top of your cover letter.`,
    });
  } else {
    items.push({
      id: 'contact-information',
      category: 'Sender Contact Header',
      status: 'Pass',
      issue: 'Sender email, phone number, location, and profile links are present.',
      explanation: 'All key sender contact fields are readable in the cover letter.',
      recommendation: 'Keep your cover letter header visually consistent with your CV.',
    });
  }

  // 3. Salutation, Opening Hook, Body & Sign-Off Structure
  if (missingSections.length > 0) {
    items.push({
      id: 'letter-structure',
      category: 'Cover Letter Components (Salutation, Body & Sign-Off)',
      status: 'Issue Found',
      issue: `Missing standard cover letter component(s): ${missingSections.join(', ')}.`,
      explanation:
        'A professional cover letter should include a personalized salutation (e.g., "Dear Hiring Manager,"), an opening hook naming the role, evidence-backed body paragraphs, and a formal sign-off (e.g., "Sincerely,").',
      recommendation: `Add clear sections in your React JSX letter for: ${missingSections.join(', ')}.`,
    });
  } else {
    items.push({
      id: 'letter-structure',
      category: 'Cover Letter Components (Salutation, Body & Sign-Off)',
      status: 'Pass',
      issue: 'Salutation, role opening, body narrative, and professional sign-off detected.',
      explanation: `Detected components: ${detectedSections.join(', ')}.`,
      recommendation: 'Address the hiring manager or team by name whenever listed in the job posting.',
    });
  }

  // 4. Tables & Multi-Column Layouts
  const tableCount = doc.querySelectorAll('table').length;
  const usesGridOrMultiColCss =
    /\b(grid-template-columns|column-count|columns\s*:)\b/i.test(renderedCss + renderedHtml);

  if (tableCount > 0 || usesGridOrMultiColCss) {
    items.push({
      id: 'tables-multicolumn',
      category: 'Tables & Multi-Column Layouts',
      status: 'Warning',
      issue: 'Detected table or multi-column layout in the cover letter.',
      explanation:
        'Standard business cover letters should follow a single-column top-to-bottom linear flow so ATS parsers do not interleave header and paragraph lines.',
      recommendation: 'Use a clean single-column layout (<header>, <main>, <p>, <footer>) for your cover letter.',
    });
  } else {
    items.push({
      id: 'tables-multicolumn',
      category: 'Tables & Multi-Column Layouts',
      status: 'Pass',
      issue: 'Clean single-column business letter layout.',
      explanation: 'Linear paragraph flow ensures accurate ATS text extraction.',
      recommendation: 'Continue using semantic <p> tags for each paragraph.',
    });
  }

  // 5. Images or Graphics
  const images = Array.from(doc.querySelectorAll('img'));
  const imagesMissingAlt = images.filter((img) => !(img.getAttribute('alt') || '').trim());
  if (images.length > 0) {
    items.push({
      id: 'images-graphics',
      category: 'Images & Signature Graphics',
      status: imagesMissingAlt.length > 0 ? 'Warning' : 'Pass',
      issue:
        imagesMissingAlt.length > 0
          ? `Found ${images.length} image(s) without alt text.`
          : `Found ${images.length} image(s) with descriptive alt attributes.`,
      explanation:
        'If you include a digital signature image or logo, always type your printed name in plain text below the signature so ATS systems can read it.',
      recommendation: 'Add alt text to any uploaded signature image and keep your typed name and contact info as plain text.',
    });
  } else {
    items.push({
      id: 'images-graphics',
      category: 'Images & Signature Graphics',
      status: 'Pass',
      issue: 'No images blocking cover letter text extraction.',
      explanation: 'All letter content is selectable plain text.',
      recommendation: 'If you add a signature image, keep your typed name underneath it.',
    });
  }

  // 6. PDF & DOCX Text Extraction Readiness
  const hasHiddenText =
    /\b(opacity\s*:\s*0|visibility\s*:\s*hidden|display\s*:\s*none|font-size\s*:\s*0)\b/i.test(
      renderedCss + renderedHtml
    );
  if (hasHiddenText || wordCount === 0) {
    items.push({
      id: 'pdf-docx-extraction',
      category: 'PDF & DOCX Text Extraction Readiness',
      status: 'Issue Found',
      issue:
        wordCount === 0
          ? 'No rendered text available to extract into PDF or DOCX.'
          : 'Hidden CSS rules (display:none / opacity:0) detected.',
      explanation: 'Hidden text or empty markup prevents clean export to PDF and Word DOCX.',
      recommendation: 'Ensure all cover letter paragraphs render visibly inside semantic HTML elements.',
    });
  } else {
    items.push({
      id: 'pdf-docx-extraction',
      category: 'PDF & DOCX Text Extraction Readiness',
      status: 'Pass',
      issue: 'Rendered cover letter DOM is clean and ready for PDF and DOCX export.',
      explanation: 'Paragraphs and headings will preserve their reading order in PDF and Word exports.',
      recommendation: 'Preview your cover letter in A4 view before exporting.',
    });
  }

  const passCount = items.filter((i) => i.status === 'Pass').length;
  const warningCount = items.filter((i) => i.status === 'Warning').length;
  const score = wordCount === 0 ? 0 : Math.round(((passCount + warningCount * 0.5) / items.length) * 100);

  return {
    score,
    wordCount,
    detectedSections,
    missingSections,
    contactInfo: {
      email: hasEmail,
      phone: hasPhone,
      location: hasLocation,
      profileLink: hasProfileLink,
    },
    items,
    disclaimer:
      'Disclaimer: This checker evaluates your saved, rendered Cover Letter for ATS readability and business letter structure. It does not guarantee acceptance by any specific employer or ATS platform.',
  };
}

/**
 * Known technical skills, tools, frameworks, and concepts for precise extraction.
 * Note: Specific tools (e.g. "REST Assured", "GitLab", "Selenium") are matched distinctly
 * from general or related concepts (e.g. "REST API", "Git", "testing").
 */
const TECH_PHRASES = [
  'REST Assured',
  'REST API',
  'Spring Boot',
  'React Native',
  'Node.js',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'Python',
  'Django',
  'FastAPI',
  'Flask',
  'Java',
  'OOP',
  'Object-Oriented Programming',
  'C#',
  'C++',
  'Go',
  'Rust',
  'Selenium',
  'Appium',
  'Cypress',
  'Playwright',
  'JUnit',
  'TestNG',
  'Pytest',
  'Vitest',
  'Jest',
  'SDET',
  'Test Automation',
  'Automation Frameworks',
  'Functional Testing',
  'API Testing',
  'Performance Testing',
  'Unit Testing',
  'CI/CD',
  'GitLab',
  'GitHub',
  'Bitbucket',
  'Jenkins',
  'GitHub Actions',
  'Docker',
  'Kubernetes',
  'Terraform',
  'AWS',
  'Azure',
  'GCP',
  'Google Cloud',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'GraphQL',
  'HTML',
  'CSS',
  'Tailwind',
  'Redux',
  'Linux',
  'Agile',
  'Scrum',
  'Git',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasExactTerm(text: string, term: string): boolean {
  const escaped = escapeRegExp(term.trim());
  const pattern = new RegExp(`(?<![A-Za-z0-9_+#.-])${escaped}(?![A-Za-z0-9_+#.-])`, 'i');
  return pattern.test(text);
}

/**
 * Extract specific technical keywords/tools mentioned in a requirement string.
 */
function extractSpecificTermsFromRequirement(req: string): string[] {
  const found: string[] = [];
  // Sort longer phrases first so "REST Assured" is checked distinctly from "REST API"
  const sortedPhrases = [...TECH_PHRASES].sort((a, b) => b.length - a.length);

  for (const phrase of sortedPhrases) {
    if (hasExactTerm(req, phrase)) {
      // Avoid adding "Git" if "GitLab" or "GitHub" was the only match in req
      if (phrase.toLowerCase() === 'git') {
        const stripped = req.replace(/\b(gitlab|github)\b/gi, '');
        if (!hasExactTerm(stripped, 'Git')) continue;
      }
      found.push(phrase);
    }
  }

  // Also extract capitalized technical tokens or acronyms (e.g. SQL, BICT, AWS, SDK, etc.) not in common stopwords
  const stopCapitals = new Set([
    'The',
    'And',
    'For',
    'With',
    'Must',
    'Have',
    'Strong',
    'Experience',
    'Knowledge',
    'Ability',
    'Degree',
    'Bachelor',
    'Bachelors',
    'Master',
    'Masters',
    'Years',
    'Year',
    'In',
    'Of',
    'Or',
    'To',
    'A',
    'An',
    'Good',
    'Solid',
    'Proven',
    'Working',
    'Understanding',
    'Familiarity',
    'Proficiency',
    'Skills',
    'Required',
    'Preferred',
    'Minimum',
    'Related',
    'Field',
    'Role',
    'Team',
    'Software',
    'Engineering',
    'Computer',
    'Science',
    'Computing',
  ]);

  const tokenMatches = req.match(/\b[A-Z][A-Za-z0-9+#./-]{1,}\b/g) || [];
  for (const tok of tokenMatches) {
    const cleanTok = tok.replace(/[.,;:]+$/, '');
    if (
      cleanTok.length >= 2 &&
      !stopCapitals.has(cleanTok) &&
      !found.some((f) => f.toLowerCase().includes(cleanTok.toLowerCase()))
    ) {
      found.push(cleanTok);
    }
  }

  return Array.from(new Set(found));
}

/**
 * Segment a pasted job description into distinct requirements and detect duplicates.
 */
export function extractJobRequirements(jobDescription: string): {
  requirements: { text: string; duplicateCount: number }[];
  duplicateCount: number;
} {
  const rawChunks = jobDescription
    .split(/\r?\n|[•·▪▫●]+/)
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length >= 3);

  const expanded: string[] = [];
  for (const chunk of rawChunks) {
    // Skip pure section headers like "Requirements:" or "Qualifications:"
    if (/^(requirements|qualifications|responsibilities|about the role|what you'll do|skills)\s*:?$/i.test(chunk)) {
      continue;
    }
    // If a single long paragraph has multiple sentences, split sentences
    if (chunk.length > 110 && /[.!;]\s+/.test(chunk)) {
      const sentences = chunk
        .split(/(?<=[.!;])\s+/)
        .map((s) => s.replace(/[.!;]+$/, '').trim())
        .filter((s) => s.length >= 4);
      expanded.push(...sentences);
    } else {
      expanded.push(chunk.replace(/[.!;]+$/, '').trim());
    }
  }

  const seenMap = new Map<string, { text: string; duplicateCount: number }>();
  let duplicateCount = 0;

  for (const req of expanded) {
    const normKey = req.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normKey) continue;
    const existing = seenMap.get(normKey);
    if (existing) {
      existing.duplicateCount += 1;
      duplicateCount += 1;
    } else {
      seenMap.set(normKey, { text: req, duplicateCount: 1 });
    }
  }

  return {
    requirements: Array.from(seenMap.values()),
    duplicateCount,
  };
}

/**
 * 7.2 Job Matcher: Compare pasted job description against the saved, rendered CV.
 * Strictly distinguishes specific required technologies from general/related skills.
 */
export function runJobMatchAnalysis(
  renderedHtml: string,
  jobDescription: string
): JobMatchAnalysisResult {
  const { fullText, lines } = parseRenderedCvDom(renderedHtml);
  const { requirements, duplicateCount } = extractJobRequirements(jobDescription);

  const comparisons: JobRequirementComparison[] = [];
  const missingKeywordsSet = new Set<string>();

  for (const reqItem of requirements) {
    const reqText = reqItem.text;
    const reqLower = reqText.toLowerCase();

    // Find best relevant CV lines for context
    const reqWords = reqLower
      .split(/[^a-z0-9+#/-]+/)
      .filter((w) => w.length >= 3 && !['and', 'the', 'for', 'with', 'years', 'strong', 'experience', 'in', 'or'].includes(w));

    const matchingCvLines = lines.filter((line) => {
      const l = line.toLowerCase();
      return reqWords.some((w) => l.includes(w));
    });

    // 1. Check degree / education requirement
    if (/\b(bachelor'?s?|master'?s?|phd|degree|b\.?sc|bict|computer science|computing)\b/i.test(reqText)) {
      const eduLines = lines.filter((l) =>
        /\b(bachelor|master|degree|b\.?sc|bict|honours|university|college|diploma|computing|computer science|pending|graduat)\b/i.test(
          l
        )
      );
      if (eduLines.length > 0) {
        const eduSummary = eduLines.slice(0, 2).join('; ');
        const isPendingOrPartial = /\b(pending|in progress|expected|undergraduate|final results)\b/i.test(eduSummary);
        const hasExactDegree = /\b(bachelor|b\.?sc|bict|master|phd|degree)\b/i.test(eduSummary);
        comparisons.push({
          requirement: reqText,
          cvInformation: eduSummary,
          status: hasExactDegree && !isPendingOrPartial ? 'Matched' : 'Partial Match',
          duplicateCount: reqItem.duplicateCount,
        });
      } else {
        comparisons.push({
          requirement: reqText,
          cvInformation: 'No degree or academic qualification mentioned in CV',
          status: 'Missing',
          duplicateCount: reqItem.duplicateCount,
        });
      }
      continue;
    }

    // 2. Check years of experience requirement (e.g. "3+ years in SDET or test automation")
    const yearsMatch = reqText.match(/(\d+)\+?\s*years?\b/i);
    if (yearsMatch) {
      const requiredYears = Number(yearsMatch[1]);
      const specificTerms = extractSpecificTermsFromRequirement(reqText);
      const matchedTerms = specificTerms.filter((t) => hasExactTerm(fullText, t));
      const missingTerms = specificTerms.filter((t) => !hasExactTerm(fullText, t));
      missingTerms.forEach((t) => missingKeywordsSet.add(t));

      const cvYearMatches = Array.from(fullText.matchAll(/(\d+)\+?\s*years?\b/gi)).map((m) => Number(m[1]));
      const maxCvYears = cvYearMatches.length > 0 ? Math.max(...cvYearMatches) : null;

      if (specificTerms.length > 0 && matchedTerms.length === 0) {
        const fallbackInfo =
          matchingCvLines.length > 0
            ? `${matchingCvLines[0]}; no dedicated ${specificTerms.join(' or ')} role`
            : `Not mentioned in CV`;
        comparisons.push({
          requirement: reqText,
          cvInformation: fallbackInfo,
          status: 'Missing',
          duplicateCount: reqItem.duplicateCount,
        });
      } else if (
        maxCvYears !== null &&
        maxCvYears >= requiredYears &&
        (specificTerms.length === 0 || matchedTerms.length === specificTerms.length)
      ) {
        comparisons.push({
          requirement: reqText,
          cvInformation: matchingCvLines[0] || `${maxCvYears} years of relevant experience documented`,
          status: 'Matched',
          duplicateCount: reqItem.duplicateCount,
        });
      } else if (maxCvYears !== null || matchedTerms.length > 0 || matchingCvLines.length > 0) {
        const yearNote =
          maxCvYears !== null && maxCvYears < requiredYears
            ? `${maxCvYears} years documented (${requiredYears}+ required)`
            : matchingCvLines[0] || `Mentioned: ${matchedTerms.join(', ')}`;
        const missingNote =
          missingTerms.length > 0 ? `; missing ${missingTerms.join(', ')}` : '';
        comparisons.push({
          requirement: reqText,
          cvInformation: `${yearNote}${missingNote}`,
          status: matchedTerms.length === 0 ? 'Missing' : 'Partial Match',
          duplicateCount: reqItem.duplicateCount,
        });
      } else {
        comparisons.push({
          requirement: reqText,
          cvInformation: 'Not mentioned',
          status: 'Missing',
          duplicateCount: reqItem.duplicateCount,
        });
      }
      continue;
    }

    // 3. Technical tools, frameworks, and domain requirements
    const specificTerms = extractSpecificTermsFromRequirement(reqText);
    if (specificTerms.length > 0) {
      const matchedTerms = specificTerms.filter((t) => hasExactTerm(fullText, t));
      const missingTerms = specificTerms.filter((t) => !hasExactTerm(fullText, t));
      missingTerms.forEach((t) => missingKeywordsSet.add(t));

      if (matchedTerms.length === 0) {
        // Check if a related but non-identical concept is in the CV (e.g. REST API vs REST Assured)
        let relatedNote = 'Not mentioned';
        if (
          specificTerms.some((t) => /rest\s+assured/i.test(t)) &&
          /\brest\s+api\b/i.test(fullText)
        ) {
          relatedNote = 'REST API integration mentioned, but not REST Assured';
        } else if (matchingCvLines.length > 0) {
          relatedNote = `${matchingCvLines[0]} (does not mention ${specificTerms.join(', ')})`;
        }

        comparisons.push({
          requirement: reqText,
          cvInformation: relatedNote,
          status: 'Missing',
          duplicateCount: reqItem.duplicateCount,
        });
        continue;
      }

      if (matchedTerms.length < specificTerms.length) {
        // Also note any extra related tools present in the matching CV line
        const contextLine = matchingCvLines[0] || `${matchedTerms.join(', ')} listed`;
        comparisons.push({
          requirement: reqText,
          cvInformation: `${contextLine} (missing: ${missingTerms.join(', ')})`,
          status: 'Partial Match',
          duplicateCount: reqItem.duplicateCount,
        });
        continue;
      }

      // All specific terms matched — check whether they are only listed in a skills list or demonstrated in detail
      const requiresStrongOrDepth = /\b(strong|deep|advanced|proven|architect|demonstrated|oop)\b/i.test(reqText);
      const matchingProjectLines = lines.filter((line) =>
        matchedTerms.some((t) => hasExactTerm(line, t)) && line.split(/\s+/).length >= 7
      );

      if (requiresStrongOrDepth && matchingProjectLines.length === 0) {
        comparisons.push({
          requirement: reqText,
          cvInformation: `${matchedTerms.join(', ')} listed, but no detailed project examples or depth shown`,
          status: 'Partial Match',
          duplicateCount: reqItem.duplicateCount,
        });
      } else {
        comparisons.push({
          requirement: reqText,
          cvInformation: matchingProjectLines[0] || matchingCvLines[0] || `${matchedTerms.join(', ')} documented in CV`,
          status: 'Matched',
          duplicateCount: reqItem.duplicateCount,
        });
      }
      continue;
    }

    // 4. General skill / responsibility clause
    const matchedWords = reqWords.filter((w) => hasExactTerm(fullText, w));
    if (matchedWords.length === 0) {
      reqWords.slice(0, 3).forEach((w) => missingKeywordsSet.add(w));
      comparisons.push({
        requirement: reqText,
        cvInformation: 'Not documented',
        status: 'Missing',
        duplicateCount: reqItem.duplicateCount,
      });
    } else if (matchedWords.length < reqWords.length) {
      comparisons.push({
        requirement: reqText,
        cvInformation: matchingCvLines[0] || `Partially covered (${matchedWords.join(', ')})`,
        status: 'Partial Match',
        duplicateCount: reqItem.duplicateCount,
      });
    } else {
      comparisons.push({
        requirement: reqText,
        cvInformation: matchingCvLines[0] || 'Documented in CV',
        status: 'Matched',
        duplicateCount: reqItem.duplicateCount,
      });
    }
  }

  const matchedCount = comparisons.filter((c) => c.status === 'Matched').length;
  const partialCount = comparisons.filter((c) => c.status === 'Partial Match').length;
  const missingCount = comparisons.filter((c) => c.status === 'Missing').length;
  const total = comparisons.length;

  const matchPercentage =
    total === 0 ? 0 : Math.round(((matchedCount + partialCount * 0.5) / total) * 100);

  const missingKeywords = Array.from(missingKeywordsSet);

  const recommendations: string[] = [];
  if (missingKeywords.length > 0) {
    recommendations.push(
      `If you have genuine hands-on experience with ${missingKeywords.slice(0, 6).join(', ')}, explicitly name those tools in your Skills and Work Experience sections rather than relying on general terms.`
    );
  }
  if (partialCount > 0) {
    recommendations.push(
      `For the ${partialCount} partially matched requirement(s), add concrete bullet points under your projects or roles showing how you applied those technologies in practice.`
    );
  }
  if (missingCount > 0) {
    recommendations.push(
      'Do not invent qualifications or tools you have not used. Instead, highlight verified coursework, certifications, or closely related engineering projects.'
    );
  }
  if (duplicateCount > 0) {
    recommendations.push(
      `Detected ${duplicateCount} repeated requirement(s) in the job description — prioritize placing your relevant experience for those core themes near the top of your CV.`
    );
  }
  if (recommendations.length === 0 && total > 0) {
    recommendations.push(
      'Your saved CV aligns strongly with the stated job requirements. Quantify key impact metrics (latency, test coverage, release frequency) to strengthen your evidence.'
    );
  }

  return {
    matchPercentage,
    matchedCount,
    partialCount,
    missingCount,
    duplicateCount,
    comparisons,
    missingKeywords,
    recommendations,
  };
}

/**
 * Common CV misspellings dictionary
 */
const COMMON_TYPOS: Record<string, string> = {
  recieve: 'receive',
  experiance: 'experience',
  managment: 'management',
  developement: 'development',
  responsable: 'responsible',
  acheived: 'achieved',
  acheivement: 'achievement',
  collabaration: 'collaboration',
  seperate: 'separate',
  occured: 'occurred',
  succesful: 'successful',
  succesfully: 'successfully',
  enviroment: 'environment',
  maintenence: 'maintenance',
  profecient: 'proficient',
  proficent: 'proficient',
  javascipt: 'JavaScript',
  typescipt: 'TypeScript',
  performace: 'performance',
  architecure: 'architecture',
  enginering: 'engineering',
  universitiy: 'university',
  bussiness: 'business',
  accomodate: 'accommodate',
  definately: 'definitely',
  independant: 'independent',
  knowlege: 'knowledge',
};

const WEAK_VERBS: { pattern: RegExp; original: string; suggestion: string }[] = [
  {
    pattern: /\bhelped\s+with\b/i,
    original: 'helped with',
    suggestion: 'Contributed to / Collaborated on',
  },
  {
    pattern: /\bworked\s+on\b/i,
    original: 'worked on',
    suggestion: 'Engineered / Developed / Delivered',
  },
  {
    pattern: /\bwas\s+responsible\s+for\b/i,
    original: 'was responsible for',
    suggestion: 'Led / Managed / Owned',
  },
  {
    pattern: /\bassisted\s+in\b/i,
    original: 'assisted in',
    suggestion: 'Supported / Facilitated',
  },
  {
    pattern: /\btried\s+to\b/i,
    original: 'tried to',
    suggestion: 'Spearheaded / Initiated',
  },
];

const UNCLEAR_PHRASES: { pattern: RegExp; phrase: string; suggestion: string }[] = [
  {
    pattern: /\betc\.?(?:\s|$)/i,
    phrase: 'etc.',
    suggestion: 'List the specific technologies or deliverables explicitly',
  },
  {
    pattern: /\bvarious\s+(?:things|tasks|stuff|items)\b/i,
    phrase: 'various things/tasks',
    suggestion: 'Specify the exact engineering tasks and measurable outcomes',
  },
  {
    pattern: /\band\s+so\s+on\b/i,
    phrase: 'and so on',
    suggestion: 'Replace open-ended filler with concrete examples',
  },
  {
    pattern: /\bmany\s+projects\b/i,
    phrase: 'many projects',
    suggestion: 'State the exact number and type of projects (e.g., "4 production microservices")',
  },
];

const UNPROFESSIONAL_PATTERNS: { pattern: RegExp; matchLabel: string; suggestion: string }[] = [
  {
    pattern: /\b(I\s+am|I\s+worked|I\s+built|I\s+did|I\s+have|my\s+job)\b/i,
    matchLabel: 'First-person pronoun ("I / my")',
    suggestion: 'Omit first-person pronouns and start directly with an action verb (e.g., "Built…", "Developed…")',
  },
  {
    pattern: /\b(awesome|super\s+good|tons\s+of|rockstar|ninja|guru|stuff)\b/i,
    matchLabel: 'Informal / casual slang',
    suggestion: 'Use formal, objective professional terminology',
  },
];

const BRAND_CASING: { regex: RegExp; proper: string }[] = [
  { regex: /\bjavascript\b/g, proper: 'JavaScript' },
  { regex: /\btypescript\b/g, proper: 'TypeScript' },
  { regex: /\bgithub\b/g, proper: 'GitHub' },
  { regex: /\bgitlab\b/g, proper: 'GitLab' },
  { regex: /\bpostgresql\b/g, proper: 'PostgreSQL' },
  { regex: /\bmongodb\b/g, proper: 'MongoDB' },
  { regex: /\bnodejs\b/g, proper: 'Node.js' },
  { regex: /\breactjs\b/g, proper: 'React' },
];

/**
 * 7.3 Grammar Checker: Inspect the saved, rendered CV text for all 8 writing & grammar categories.
 * Does NOT modify the user's React code automatically.
 */
export function runGrammarCheck(renderedHtml: string): GrammarAnalysisResult {
  const { lines } = parseRenderedCvDom(renderedHtml);
  const issues: GrammarIssueItem[] = [];
  let idCounter = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Spelling mistakes
    const words = trimmed.split(/[^A-Za-z']+/).filter(Boolean);
    for (const word of words) {
      const lower = word.toLowerCase();
      if (COMMON_TYPOS[lower]) {
        const correction = COMMON_TYPOS[lower];
        issues.push({
          id: `grammar-${idCounter++}`,
          originalText: word,
          issueType: 'Spelling Mistake',
          suggestedCorrection: correction,
          explanation: `"${word}" appears to be misspelled in "${trimmed}". Replace with "${correction}".`,
        });
      }
    }

    // 2. Grammar mistakes (e.g., "a" before vowel sound, subject-verb mismatch)
    const aBeforeVowel = trimmed.match(/\b(a)\s+([aeiouAEIOU][a-z]{2,})\b/);
    if (aBeforeVowel && !/^uni|^use|^eur|^one/i.test(aBeforeVowel[2])) {
      issues.push({
        id: `grammar-${idCounter++}`,
        originalText: `${aBeforeVowel[1]} ${aBeforeVowel[2]}`,
        issueType: 'Grammar Mistake',
        suggestedCorrection: `an ${aBeforeVowel[2]}`,
        explanation: 'Use the article "an" before words starting with a vowel sound.',
      });
    }

    const grammarMismatch = trimmed.match(/\b(was\s+develop|have\s+build|is\s+lead|were\s+create|to\s+developed)\b/i);
    if (grammarMismatch) {
      const raw = grammarMismatch[1];
      const fixed = raw
        .replace(/was\s+develop/i, 'developed')
        .replace(/have\s+build/i, 'built')
        .replace(/is\s+lead/i, 'led')
        .replace(/were\s+create/i, 'created')
        .replace(/to\s+developed/i, 'to develop');
      issues.push({
        id: `grammar-${idCounter++}`,
        originalText: raw,
        issueType: 'Grammar Mistake',
        suggestedCorrection: fixed,
        explanation: 'Verb tense or auxiliary verb form is grammatically incorrect.',
      });
    }

    // 3. Repeated words (e.g. "the the", "and and")
    const repeatedMatch = trimmed.match(/\b([A-Za-z]{2,})\s+\1\b/i);
    if (repeatedMatch) {
      issues.push({
        id: `grammar-${idCounter++}`,
        originalText: repeatedMatch[0],
        issueType: 'Repeated Words',
        suggestedCorrection: repeatedMatch[1],
        explanation: `The word "${repeatedMatch[1]}" is repeated consecutively.`,
      });
    }

    // 4. Sentence structure issues (overly long run-on sentence > 35 words or passive voice)
    const lineWordCount = trimmed.split(/\s+/).length;
    if (lineWordCount > 35) {
      issues.push({
        id: `grammar-${idCounter++}`,
        originalText: `${trimmed.slice(0, 75)}…`,
        issueType: 'Sentence Structure',
        suggestedCorrection: 'Split into two concise bullet points (15–25 words each)',
        explanation: `This sentence is ${lineWordCount} words long. Concise bullet points are easier for recruiters to scan quickly.`,
      });
    } else if (/\b(was|were)\s+(developed|managed|created|built|handled|designed)\s+by\b/i.test(trimmed)) {
      const passiveMatch = trimmed.match(/\b(was|were)\s+(developed|managed|created|built|handled|designed)\s+by\b/i);
      if (passiveMatch) {
        issues.push({
          id: `grammar-${idCounter++}`,
          originalText: passiveMatch[0],
          issueType: 'Sentence Structure',
          suggestedCorrection: `Active voice (e.g., "${passiveMatch[2][0].toUpperCase() + passiveMatch[2].slice(1)}…")`,
          explanation: 'Active voice demonstrates direct ownership and impact more effectively than passive voice.',
        });
      }
    }

    // 5. Unclear descriptions
    for (const item of UNCLEAR_PHRASES) {
      const m = trimmed.match(item.pattern);
      if (m) {
        issues.push({
          id: `grammar-${idCounter++}`,
          originalText: m[0].trim(),
          issueType: 'Unclear Description',
          suggestedCorrection: item.suggestion,
          explanation: `Vague phrasing ("${m[0].trim()}") weakens CV credibility. Be specific about scope and results.`,
        });
      }
    }

    // 6. Inconsistent capitalization and punctuation
    if (trimmed.length > 15 && /^[a-z]/.test(trimmed) && !/^(https?:|mailto:|[a-z0-9._%+-]+@)/.test(trimmed)) {
      const capitalized = `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
      issues.push({
        id: `grammar-${idCounter++}`,
        originalText: trimmed,
        issueType: 'Capitalization & Punctuation',
        suggestedCorrection: capitalized,
        explanation: 'Start CV sentences, headings, and bullet points with an uppercase letter.',
      });
    }

    if (/[!?]{2,}|\.{4,}/.test(trimmed)) {
      issues.push({
        id: `grammar-${idCounter++}`,
        originalText: trimmed,
        issueType: 'Capitalization & Punctuation',
        suggestedCorrection: trimmed.replace(/[!?]{2,}/g, '.').replace(/\.{4,}/g, '.'),
        explanation: 'Avoid multiple exclamation marks, question marks, or excessive ellipses in a professional CV.',
      });
    }

    for (const brand of BRAND_CASING) {
      if (brand.regex.test(trimmed)) {
        brand.regex.lastIndex = 0;
        issues.push({
          id: `grammar-${idCounter++}`,
          originalText: brand.proper.toLowerCase(),
          issueType: 'Capitalization & Punctuation',
          suggestedCorrection: brand.proper,
          explanation: `Use the standard industry capitalization "${brand.proper}".`,
        });
      }
    }

    // 7. Weak action verbs
    for (const verb of WEAK_VERBS) {
      const m = trimmed.match(verb.pattern);
      if (m) {
        issues.push({
          id: `grammar-${idCounter++}`,
          originalText: m[0],
          issueType: 'Weak Action Verb',
          suggestedCorrection: verb.suggestion,
          explanation: `Replace "${m[0]}" with a stronger, impact-oriented action verb.`,
        });
      }
    }

    // 8. Unprofessional wording
    for (const unprof of UNPROFESSIONAL_PATTERNS) {
      const m = trimmed.match(unprof.pattern);
      if (m) {
        issues.push({
          id: `grammar-${idCounter++}`,
          originalText: m[0],
          issueType: 'Unprofessional Wording',
          suggestedCorrection: unprof.suggestion,
          explanation: `${unprof.matchLabel} detected in "${trimmed}". Use formal third-person implied CV style.`,
        });
      }
    }
  }

  return {
    totalIssues: issues.length,
    checkedSentences: lines.length,
    issues,
  };
}

