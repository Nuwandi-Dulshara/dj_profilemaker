import { useEffect, useMemo, useState } from 'react';
import { GitBranch, ExternalLink, Plus } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { api } from '../../services/api';
import { formatDate, useRefreshWorkspace, type Project } from '../dashboard/data';

export interface CvVersionEntry {
  id: string;
  title: string;
  target_role: string;
  is_base: boolean;
  is_current: boolean;
  updated_at: string;
  files: Record<string, string>;
}

interface VersionsResponse {
  base_id: string;
  current_id: string;
  versions: CvVersionEntry[];
}

interface FileDiffSummary {
  file: string;
  status: 'added' | 'removed' | 'modified';
  addedLines: number;
  removedLines: number;
}

function compareVersionFiles(left: Record<string, string>, right: Record<string, string>): FileDiffSummary[] {
  const allKeys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  const diffs: FileDiffSummary[] = [];

  for (const key of allKeys) {
    const a = left[key];
    const b = right[key];
    if (a === undefined && b !== undefined) {
      diffs.push({ file: key, status: 'added', addedLines: b.split('\n').length, removedLines: 0 });
    } else if (a !== undefined && b === undefined) {
      diffs.push({ file: key, status: 'removed', addedLines: 0, removedLines: a.split('\n').length });
    } else if (a !== b) {
      const aLines = (a ?? '').split('\n');
      const bLines = (b ?? '').split('\n');
      const aSet = new Set(aLines);
      const bSet = new Set(bLines);
      const addedLines = bLines.filter((line) => !aSet.has(line)).length;
      const removedLines = aLines.filter((line) => !bSet.has(line)).length;
      diffs.push({ file: key, status: 'modified', addedLines, removedLines });
    }
  }

  return diffs;
}

export function CvVersionsDialog({
  projectId,
  projectTitle,
  onSaveCurrent,
  onOpenProject,
  onClose,
}: {
  projectId: string;
  projectTitle: string;
  onSaveCurrent: () => Promise<void>;
  onOpenProject: (id: string) => void;
  onClose: () => void;
}) {
  const refresh = useRefreshWorkspace();
  const [data, setData] = useState<VersionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  async function loadVersions(signal?: AbortSignal) {
    setLoading(true);
    setError('');
    try {
      const res = await api<VersionsResponse>(`/projects/${projectId}/versions/`, { signal });
      setData(res);
      const base = res.versions.find((v) => v.is_base) ?? res.versions[0];
      const current = res.versions.find((v) => v.is_current) ?? res.versions[res.versions.length - 1];
      setLeftId((prev) => prev || base?.id || '');
      setRightId((prev) => prev || current?.id || '');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadVersions(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleCreateVariant(e: React.FormEvent) {
    e.preventDefault();
    const role = targetRole.trim();
    if (!role) return;
    setCreating(true);
    setError('');
    try {
      await onSaveCurrent();
      const created = await api<Project>(`/projects/${projectId}/create-variant/`, {
        method: 'POST',
        body: JSON.stringify({
          target_role: role,
          title: customTitle.trim() || undefined,
        }),
      });
      await refresh();
      setTargetRole('');
      setCustomTitle('');
      onClose();
      onOpenProject(created.id);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  const versions = data?.versions ?? [];
  const leftVersion = versions.find((v) => v.id === leftId);
  const rightVersion = versions.find((v) => v.id === rightId);
  const fileDiffs = useMemo(
    () => (leftVersion && rightVersion ? compareVersionFiles(leftVersion.files, rightVersion.files) : []),
    [leftVersion, rightVersion]
  );

  return (
    <Dialog title="Job-Specific CV Versions" onClose={() => !creating && onClose()}>
      <div className="dash-form adv-cv-versions">
        <p className="dash-dialog-lead">
          Create tailored CV versions for different job applications while keeping your base CV (<strong>{projectTitle}</strong>) intact.
        </p>

        <form className="adv-cv-version-create" onSubmit={(e) => void handleCreateVariant(e)}>
          <label>
            Target Job / Company
            <input
              type="text"
              required
              placeholder="e.g. Stripe — Backend Engineer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </label>
          <label>
            Version Title (optional)
            <input
              type="text"
              placeholder="Auto-generated from base CV & target role"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </label>
          <button type="submit" className="button button-primary" disabled={creating || !targetRole.trim()}>
            <Plus size={15} />
            {creating ? 'Creating…' : 'Create Job Version'}
          </button>
        </form>

        {error && (
          <p className="dash-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p role="status">Loading linked CV versions…</p>
        ) : (
          <>
            <div className="adv-cv-version-list" aria-label="Linked CV Versions">
              <strong>Linked Versions ({versions.length})</strong>
              {versions.map((ver) => (
                <div key={ver.id} className={`adv-cv-version-item ${ver.is_current ? 'is-current' : ''}`}>
                  <div>
                    <strong>{ver.title}</strong>
                    <span className="adv-cv-version-meta">
                      {ver.is_base ? 'Base CV' : `Target: ${ver.target_role || 'Job Variant'}`} · Updated{' '}
                      {formatDate(ver.updated_at)}
                    </span>
                  </div>
                  {ver.is_current ? (
                    <span className="adv-cv-version-badge">Current</span>
                  ) : (
                    <button
                      type="button"
                      className="dash-secondary"
                      onClick={() => {
                        onClose();
                        onOpenProject(ver.id);
                      }}
                    >
                      <ExternalLink size={14} />
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>

            {versions.length > 1 && (
              <div className="adv-cv-version-compare" aria-label="Compare CV Versions">
                <strong>
                  <GitBranch size={15} /> Compare Versions
                </strong>
                <div className="adv-cv-version-selectors">
                  <label>
                    From
                    <select aria-label="Compare base version" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To
                    <select aria-label="Compare target version" value={rightId} onChange={(e) => setRightId(e.target.value)}>
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {leftId === rightId ? (
                  <p className="dash-caption">Select two different versions to compare changes.</p>
                ) : fileDiffs.length === 0 ? (
                  <p className="dash-caption">No file differences between these two versions yet.</p>
                ) : (
                  <ul className="adv-cv-version-diffs">
                    {fileDiffs.map((diff) => (
                      <li key={diff.file}>
                        <code>{diff.file}</code> — <strong>{diff.status}</strong> (+{diff.addedLines} / -{diff.removedLines} lines)
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

