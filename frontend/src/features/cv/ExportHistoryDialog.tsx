import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { api } from '../../services/api';
import { formatDate } from '../dashboard/data';

interface ExportEventItem {
  id: string;
  format: 'pdf' | 'docx';
  created_at: string;
}

interface ExportSummaryResponse {
  pdf_count: number;
  docx_count: number;
  total_count: number;
  events: ExportEventItem[];
}

export function ExportHistoryDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ExportSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<ExportSummaryResponse>(`/projects/${projectId}/exports/`, { signal: controller.signal })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [projectId]);

  return (
    <Dialog title="Export History" onClose={onClose}>
      <div className="dash-form adv-cv-versions">
        {error && (
          <p className="dash-error" role="alert">
            {error}
          </p>
        )}
        {loading || !data ? (
          <p role="status">Loading export history…</p>
        ) : (
          <>
            <div className="adv-cv-export-stats" aria-label="Export Counts">
              <div className="adv-cv-export-stat">
                <strong>{data.total_count}</strong>
                <span>Total Exports</span>
              </div>
              <div className="adv-cv-export-stat">
                <strong>{data.pdf_count}</strong>
                <span>PDF Downloads</span>
              </div>
              <div className="adv-cv-export-stat">
                <strong>{data.docx_count}</strong>
                <span>DOCX Downloads</span>
              </div>
            </div>

            {data.events.length === 0 ? (
              <p className="dash-caption">No downloads recorded for this document yet.</p>
            ) : (
              <div className="adv-cv-version-list" aria-label="Recent Exports">
                {data.events.map((ev) => (
                  <div key={ev.id} className="adv-cv-version-item">
                    <div>
                      <strong>
                        <Download size={13} /> {ev.format.toUpperCase()} Export
                      </strong>
                      <span className="adv-cv-version-meta">{formatDate(ev.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

