import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, Printer } from 'lucide-react';
import { api } from '../../services/api';
import { compileAndRenderCvWorkspace } from './cvRuntime';
import { openRenderedPdfInNewTab } from './pdfGenerator';
import './advanced-cv.css';

interface PublicSharePayload {
  title: string;
  kind: 'advanced_cv' | 'cover_letter';
  updated_at: string;
  content: { files?: Record<string, string>; folders?: string[] };
  design: Record<string, unknown>;
}

export function PublicSharePage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicSharePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<PublicSharePayload>(`/public/share/${encodeURIComponent(token)}/`, { signal: controller.signal })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'This shared document is unavailable.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  const compiled = useMemo(() => {
    const files = data?.content?.files && typeof data.content.files === 'object' ? data.content.files : {};
    return compileAndRenderCvWorkspace(files);
  }, [data]);

  if (loading) {
    return (
      <main className="adv-cv-public-shell" aria-label="Shared Document">
        <p role="status">Loading shared document…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="adv-cv-public-shell" aria-label="Shared Document Unavailable">
        <div className="adv-cv-public-empty">
          <FileText size={32} />
          <h1>Shared document unavailable</h1>
          <p>{error || 'This share link may have been revoked or removed.'}</p>
          <Link className="button button-primary" to="/">
            Go to Studio Home
          </Link>
        </div>
      </main>
    );
  }

  const pages = compiled.pages.length > 0 ? compiled.pages : [compiled.html || `<p>${data.title}</p>`];

  return (
    <main className="adv-cv-public-shell" aria-label="Read-Only Shared Document">
      <header className="adv-cv-public-bar">
        <div>
          <span className="eyebrow">READ-ONLY SHARED {data.kind === 'cover_letter' ? 'COVER LETTER' : 'CV'}</span>
          <h1>{data.title}</h1>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => void openRenderedPdfInNewTab(pages, compiled.css, data.title || 'Shared Document')}
        >
          <Printer size={16} />
          Open PDF
        </button>
      </header>

      <div className="adv-cv-public-stage">
        {compiled.css && <style>{compiled.css}</style>}
        <div className="adv-cv-a4-stack">
          {pages.map((pageHtml, idx) => (
            <article
              key={`shared-page-${idx + 1}`}
              className="adv-cv-a4-page"
              aria-label={`Shared Document Page ${idx + 1}`}
            >
              {pages.length > 1 && (
                <div className="adv-cv-a4-page-num">
                  Page {idx + 1} of {pages.length}
                </div>
              )}
              <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

