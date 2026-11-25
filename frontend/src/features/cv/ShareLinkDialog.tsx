import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { api } from '../../services/api';

interface ShareLinkData {
  token: string;
  is_active: boolean;
  created_at: string;
}

export function ShareLinkDialog({
  projectId,
  projectTitle,
  onClose,
}: {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
}) {
  const [share, setShare] = useState<ShareLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<{ share: ShareLinkData | null }>(`/projects/${projectId}/share/`, { signal: controller.signal })
      .then((res) => {
        setShare(res.share);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [projectId]);

  const shareUrl = share ? `${window.location.origin}/share/${share.token}` : '';

  async function handleGenerate() {
    setBusy(true);
    setError('');
    try {
      const res = await api<{ share: ShareLinkData }>(`/projects/${projectId}/share/`, { method: 'POST' });
      setShare(res.share);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${projectId}/share/`, { method: 'DELETE' });
      setShare(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be restricted in test environments.
    }
  }

  return (
    <Dialog title="Public Read-Only Share Link" onClose={() => !busy && onClose()}>
      <div className="dash-form adv-cv-versions">
        <p className="dash-dialog-lead">
          Share <strong>{projectTitle}</strong> with recruiters using a read-only link. Viewers can read and print the rendered document without editing or seeing source code.
        </p>

        {error && (
          <p className="dash-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p role="status">Checking share link status…</p>
        ) : share ? (
          <>
            <label>
              Public Share URL
              <input type="text" readOnly value={shareUrl} aria-label="Public Share URL" />
            </label>
            <div className="adv-cv-company-actions">
              <button type="button" className="button button-primary" onClick={() => void handleCopy()}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied Link!' : 'Copy Share Link'}
              </button>
              <a className="dash-secondary" href={shareUrl} target="_blank" rel="noreferrer">
                Open Read-Only View
              </a>
              <button type="button" className="dash-secondary" disabled={busy} onClick={() => void handleRevoke()}>
                <Trash2 size={15} />
                Revoke Link
              </button>
            </div>
          </>
        ) : (
          <div className="adv-cv-company-actions">
            <button type="button" className="button button-primary" disabled={busy} onClick={() => void handleGenerate()}>
              <Link2 size={15} />
              {busy ? 'Generating…' : 'Generate Public Share Link'}
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

