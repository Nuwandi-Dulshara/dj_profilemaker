import type { CareerProfileData } from './careerProfile';

export interface WritingSuggestion {
  improvedText: string;
  changes: string[];
}

export interface SmartSkillRecommendation {
  skill: string;
  reason: string;
  source: 'career-profile' | 'grouping';
}

const WEAK_PHRASE_REPLACEMENTS: Array<[RegExp, string, string]> = [
  [/\bresponsible for\b/gi, 'Led', 'Replaced "responsible for" with stronger action verb "Led"'],
  [/\bworked on\b/gi, 'Engineered', 'Replaced "worked on" with "Engineered"'],
  [/\bhelped with\b/gi, 'Contributed to', 'Replaced "helped with" with "Contributed to"'],
  [/\bassisted in\b/gi, 'Supported', 'Replaced "assisted in" with "Supported"'],
  [/\bhandled\b/gi, 'Managed', 'Replaced "handled" with "Managed"'],
  [/\bmade\b/gi, 'Built', 'Replaced "made" with "Built"'],
  [/\bvarious things\b/gi, 'key deliverables', 'Replaced vague phrase "various things" with "key deliverables"'],
  [/\bin order to\b/gi, 'to', 'Tightened "in order to" to "to"'],
  [/\bwas able to\b/gi, 'successfully', 'Tightened "was able to" to "successfully"'],
];

const TECH_CASING: Array<[RegExp, string]> = [
  [/\bjavascript\b/gi, 'JavaScript'],
  [/\btypescript\b/gi, 'TypeScript'],
  [/\bpostgresql\b/gi, 'PostgreSQL'],
  [/\bmysql\b/gi, 'MySQL'],
  [/\bfastapi\b/gi, 'FastAPI'],
  [/\bdjango\b/gi, 'Django'],
  [/\breact\.?js\b/gi, 'React'],
  [/\bnode\.?js\b/gi, 'Node.js'],
];

/**
 * Rule-based local writing assistant that strengthens action verbs, tightens phrasing,
 * and standardizes technical capitalization without inventing false qualifications.
 */
export function improveSelectedWriting(input: string): WritingSuggestion {
  const original = input.trim();
  if (!original) {
    return { improvedText: '', changes: [] };
  }

  let next = original.replace(/\s+/g, ' ');
  const changes: string[] = [];

  for (const [pattern, replacement, note] of WEAK_PHRASE_REPLACEMENTS) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      changes.push(note);
    }
  }

  for (const [pattern, canonical] of TECH_CASING) {
    const match = next.match(pattern);
    if (match && match[0] !== canonical) {
      next = next.replace(pattern, canonical);
      changes.push(`Standardized "${match[0]}" to "${canonical}"`);
    }
  }

  // Capitalize first letter if it looks like a sentence/bullet
  if (/^[a-z]/.test(next)) {
    next = next.charAt(0).toUpperCase() + next.slice(1);
    changes.push('Capitalized sentence start');
  }

  // Remove repeated adjacent words (e.g. "the the")
  const deduped = next.replace(/\b([A-Za-z]+)\s+\1\b/gi, '$1');
  if (deduped !== next) {
    next = deduped;
    changes.push('Removed repeated consecutive word');
  }

  if (changes.length === 0) {
    changes.push('Text already uses concise phrasing. Consider adding a measurable outcome (e.g., %, time saved, or scale) if applicable.');
  }

  return { improvedText: next, changes };
}

/**
 * Recommends skills the user already has in their Career Profile that are missing from
 * the current rendered document, plus ATS grouping suggestions — never adding unverified skills.
 */
export function buildSmartSkillSuggestions(
  renderedHtml: string,
  profile: CareerProfileData | null | undefined
): SmartSkillRecommendation[] {
  const plainText = renderedHtml
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();

  const recommendations: SmartSkillRecommendation[] = [];
  const profileSkills = Array.isArray(profile?.skills) ? profile!.skills : [];

  for (const skill of profileSkills) {
    const clean = skill.trim();
    if (!clean) continue;
    if (!plainText.includes(clean.toLowerCase())) {
      recommendations.push({
        skill: clean,
        reason: 'Present in your Career Profile Vault, but not yet mentioned in this document.',
        source: 'career-profile',
      });
    }
  }

  // Check if any existing skills could be grouped cleanly for ATS readability
  const foundSkills = profileSkills.filter((s) => s.trim() && plainText.includes(s.trim().toLowerCase()));
  if (foundSkills.length >= 4 && !/languages|frameworks|databases|tools/i.test(plainText)) {
    recommendations.push({
      skill: 'Group skills by category (Languages, Frameworks, Databases)',
      reason: `You already list ${foundSkills.length} verified skills; grouping them improves recruiter & ATS scan speed.`,
      source: 'grouping',
    });
  }

  return recommendations;
}

