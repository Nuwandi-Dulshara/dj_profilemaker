import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { api } from '../../services/api';
import { formatDate } from '../dashboard/data';

export interface SnapshotItem {
  id: string;
  revision: number;
  title: string;
  content: { files?: Record<string, string>; folders?: string[] };
  design: Record<string, unknown>;
  created_at: string;
}

export function VersionHistoryDialog({
  projectId,
  onRestored,
  onClose,
}: {
  projectId: string;
  onRestored: (payload: {
    title: string;
    content: { files?: Record<string, string>; folders?: string[] };
    design: Record<string, unknown>;
    restoredFromRevision: number;
  }) => void;
  onClose: () => void;
}) {
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<{ snapshots: SnapshotItem[] }>(`/projects/${projectId}/snapshots/`, { signal: controller.signal })
      .then((res) => {
        setSnapshots(res.snapshots || []);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [projectId]);

  async function handleRestore(snap: SnapshotItem) {
    setRestoringId(snap.id);
    setError('');
    try {
      const res = await api<{
        project: { title: string };
        content: { files?: Record<string, string>; folders?: string[] };
        design: Record<string, unknown>;
        restored_from_revision: number;
      }>(`/projects/${projectId}/snapshots/${snap.id}/restore/`, { method: 'POST' });
      onRestored({
        title: res.project.title,
        content: res.content,
        design: res.design,
        restoredFromRevision: res.restored_from_revision,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setRestoringId(null);
    }
  }

  return (
    <Dialog title="Version History" onClose={() => !restoringId && onClose()}>
      <div className="dash-form adv-cv-versions">
        <p className="dash-dialog-lead">
          Every time you save, a snapshot is recorded. You can restore any earlier revision without losing the ability to revert later.
        </p>

        {error && (
          <p className="dash-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p role="status">Loading saved revisions…</p>
        ) : snapshots.length === 0 ? (
          <p className="dash-caption">No saved snapshots yet. Save your project to create the first revision.</p>
        ) : (
          <div className="adv-cv-version-list" aria-label="Saved Version History">
            {snapshots.map((snap, idx) => {
              const fileCount = Object.keys(snap.content?.files || {}).length;
              return (
                <div key={snap.id} className={`adv-cv-version-item ${idx === 0 ? 'is-current' : ''}`}>
                  <div>
                    <strong>
                      Revision #{snap.revision} — {snap.title}
                    </strong>
                    <span className="adv-cv-version-meta">
                      {fileCount} {fileCount === 1 ? 'file' : 'files'} · Saved {formatDate(snap.created_at)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="dash-secondary"
                    disabled={Boolean(restoringId)}
                    onClick={() => void handleRestore(snap)}
                  >
                    {idx === 0 ? <History size={14} /> : <RotateCcw size={14} />}
                    {restoringId === snap.id ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}

