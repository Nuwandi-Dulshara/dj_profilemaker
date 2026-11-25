import { AlertTriangle, BookOpen, Clock, FileText } from 'lucide-react';

function extractPlainWords(html: string): string[] {
  if (!html.trim()) return [];
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return [];
  return stripped.split(' ').filter(Boolean);
}

export function computeLiveMetrics(html: string, pageCount: number, recommendedMaxPages: number) {
  const words = extractPlainWords(html);
  const wordCount = words.length;
  const readingMinutes = wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / 200));
  const effectivePages = wordCount === 0 && pageCount <= 1 ? 0 : Math.max(1, pageCount);
  const exceedsLimit = effectivePages > recommendedMaxPages;
  return { wordCount, readingMinutes, effectivePages, exceedsLimit };
}

export function LiveMetricsBar({
  html,
  pageCount,
  recommendedMaxPages,
  documentLabel,
}: {
  html: string;
  pageCount: number;
  recommendedMaxPages: number;
  documentLabel: 'CV' | 'Cover Letter';
}) {
  const { wordCount, readingMinutes, effectivePages, exceedsLimit } = computeLiveMetrics(
    html,
    pageCount,
    recommendedMaxPages
  );

  return (
    <div className="adv-cv-metrics-bar" role="status" aria-label={`${documentLabel} Live Metrics`}>
      <span className="adv-cv-metric-item">
        <FileText size={14} />
        <strong>{wordCount}</strong> {wordCount === 1 ? 'word' : 'words'}
      </span>
      <span className="adv-cv-metric-item">
        <BookOpen size={14} />
        <strong>{effectivePages}</strong> A4 {effectivePages === 1 ? 'page' : 'pages'}
      </span>
      <span className="adv-cv-metric-item">
        <Clock size={14} />
        <strong>{readingMinutes === 0 ? '0 min' : `~${readingMinutes} min`}</strong> read
      </span>
      {exceedsLimit && (
        <span className="adv-cv-metric-warning" role="alert">
          <AlertTriangle size={14} />
          Exceeds recommended {recommendedMaxPages}-page {documentLabel} limit ({effectivePages} pages)
        </span>
      )}
    </div>
  );
}

