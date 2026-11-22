import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, UserCheck } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { api } from '../../services/api';
import type { Project, ProjectsResponse } from '../dashboard/data';
import {
  CAREER_PROFILE_BACKUP_FILE,
  CAREER_PROFILE_FILE,
  CAREER_SECTION_KEYS,
  CAREER_SECTION_LABELS,
  CV_IMPORT_FILE,
  buildCareerProfileImport,
  changedSectionsSinceImport,
  countSectionItems,
  extractCvImport,
  importedFileWasEdited,
  sectionHasContent,
  usageHint,
  type CareerImportResult,
  type CareerProfileData,
  type CareerSectionKey,
  type DocumentImports,
} from './careerProfile';

type Source = 'profile' | 'cv';

export function CareerImportDialog({
  kind,
  files,
  imports,
  onClose,
  onApply,
}: {
  kind: 'cv' | 'cover_letter';
  files: Record<string, string>;
  imports: DocumentImports;
  onClose: () => void;
  onApply: (result: CareerImportResult) => void;
}) {
  const isLetter = kind === 'cover_letter';
  const [source, setSource] = useState<Source>(isLetter && imports.cv && !imports.career_profile ? 'cv' : 'profile');

  // ----- Career Profile source -----
  const [profile, setProfile] = useState<CareerProfileData | null>(null);
  const [profileError, setProfileError] = useState('');
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Set<CareerSectionKey> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setProfile(null);
    setProfileError('');
    api<CareerProfileData>('/career-profile/', { signal: controller.signal })
      .then((data) => {
        setProfile(data);
        setSelected((prev) => {
          if (prev) return prev;
          const previous = imports.career_profile?.sections;
          return new Set(previous?.length ? previous : CAREER_SECTION_KEYS.filter((key) => sectionHasContent(data, key)));
        });
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setProfileError(err.message);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  // ----- CV source (cover letters only) -----
  const [cvList, setCvList] = useState<Project[] | null>(null);
  const [cvError, setCvError] = useState('');
  const [cvId, setCvId] = useState(imports.cv?.projectId ?? '');

  useEffect(() => {
    if (!isLetter) return;
    const controller = new AbortController();
    api<ProjectsResponse>('/projects/?kind=advanced_cv&state=active&page_size=50&ordering=-updated_at', {
      signal: controller.signal,
    })
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : [];
        setCvList(list);
        setCvId((current) => current || list[0]?.id || '');
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setCvError(err.message);
      });
    return () => controller.abort();
  }, [isLetter]);

  const [keepBackup, setKeepBackup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const profileMeta = imports.career_profile;
  const cvMeta = imports.cv;
  const activeFile = source === 'profile' ? CAREER_PROFILE_FILE : CV_IMPORT_FILE;
  const activeMeta = source === 'profile' ? profileMeta : cvMeta;
  const fileExists = files[activeFile] !== undefined;
  const edited = activeMeta ? importedFileWasEdited(files, activeFile, activeMeta.contentHash) : false;
  const overwritesUnknownFile = fileExists && !activeMeta;
  const needsBackupChoice = fileExists && (edited || overwritesUnknownFile);

  const changedSections = useMemo(
    () => (profile && profileMeta ? changedSectionsSinceImport(profile, profileMeta) : []),
    [profile, profileMeta]
  );
  const profileIsEmpty = profile ? CAREER_SECTION_KEYS.every((key) => !sectionHasContent(profile, key)) : false;
  const selectedCv = cvList?.find((item) => item.id === cvId);
  const cvChanged = Boolean(cvMeta && selectedCv && cvMeta.projectId === selectedCv.id && selectedCv.updated_at !== cvMeta.sourceUpdatedAt);
  const isRefresh = Boolean(activeMeta);

  function toggle(key: CareerSectionKey) {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function backupFiles(): Record<string, string> {
    if (!needsBackupChoice || !keepBackup) return {};
    const backupName = source === 'profile' ? CAREER_PROFILE_BACKUP_FILE : 'cv-import.previous.json';
    return { [backupName]: files[activeFile] };
  }

  function applyProfile() {
    if (!profile || !selected) return;
    const sections = CAREER_SECTION_KEYS.filter((key) => selected.has(key));
    const { content, meta } = buildCareerProfileImport(profile, sections);
    onApply({
      files: { ...backupFiles(), [CAREER_PROFILE_FILE]: content },
      imports: { career_profile: meta },
      openFile: CAREER_PROFILE_FILE,
      message: `${isRefresh ? 'Refreshed' : 'Imported'} Career Profile into ${CAREER_PROFILE_FILE} (your Career Profile was not changed). ${usageHint(CAREER_PROFILE_FILE)}`,
    });
    onClose();
  }

  async function applyCv() {
    if (!selectedCv) return;
    setBusy(true);
    setError('');
    try {
      const doc = await api<{ content: { files?: Record<string, string> } }>(`/projects/${selectedCv.id}/document/`);
      const { content, meta } = extractCvImport(doc.content?.files ?? {}, {
        projectId: selectedCv.id,
        title: selectedCv.title,
        updatedAt: selectedCv.updated_at,
      });
      onApply({
        files: { ...backupFiles(), [CV_IMPORT_FILE]: content },
        imports: { cv: meta },
        openFile: CV_IMPORT_FILE,
        message: `${isRefresh ? 'Refreshed' : 'Imported'} details from “${selectedCv.title}” into ${CV_IMPORT_FILE} (the CV was not changed). ${usageHint(CV_IMPORT_FILE)}`,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = isLetter ? 'Import from Career Profile / CV' : 'Import from Career Profile';
  const noSections = source === 'profile' && (!selected || selected.size === 0);

  return (
    <Dialog title={title} onClose={() => !busy && onClose()}>
      <div className="dash-form adv-cv-import">
        <p className="dash-dialog-lead">
          Enter your professional details once and reuse them here. The import creates an <strong>editable copy</strong> inside this project, so you can change it
          freely without changing your original{isLetter ? ' Career Profile or CV' : ' Career Profile'}.
        </p>

        {isLetter && (
          <div className="adv-cv-import-tabs" role="tablist" aria-label="Import source">
            <button type="button" role="tab" aria-selected={source === 'profile'} className={source === 'profile' ? 'is-active' : ''} onClick={() => setSource('profile')}>
              Career Profile
            </button>
            <button type="button" role="tab" aria-selected={source === 'cv'} className={source === 'cv' ? 'is-active' : ''} onClick={() => setSource('cv')}>
              An existing CV
            </button>
          </div>
        )}

        {source === 'profile' && (
          <>
            {profileError ? (
              <p className="dash-error" role="alert">
                {profileError}{' '}
                <button type="button" className="dash-link" onClick={() => setReload((n) => n + 1)}>
                  Try again
                </button>
              </p>
            ) : !profile ? (
              <p role="status">Loading your Career Profile…</p>
            ) : profileIsEmpty ? (
              <p className="adv-cv-import-note is-warning" role="status">
                <AlertTriangle size={16} />
                <span>
                  Your Career Profile is empty. Fill it in once under{' '}
                  <Link to="/dashboard/profile" onClick={onClose}>
                    User Profile → Career Profile Vault
                  </Link>
                  , then come back to import it.
                </span>
              </p>
            ) : (
              <>
                {profileMeta && (
                  <p className={`adv-cv-import-note ${changedSections.length ? 'is-warning' : 'is-ok'}`} role="status">
                    {changedSections.length ? <RefreshCw size={16} /> : <CheckCircle2 size={16} />}
                    <span>
                      {changedSections.length
                        ? `Your Career Profile changed since you imported it: ${changedSections.map((k) => CAREER_SECTION_LABELS[k]).join(', ')}.`
                        : 'This project is up to date with your Career Profile.'}
                    </span>
                  </p>
                )}

                <fieldset className="adv-cv-import-sections">
                  <legend>Choose what to import</legend>
                  {CAREER_SECTION_KEYS.map((key) => {
                    const count = countSectionItems(profile, key);
                    const empty = !sectionHasContent(profile, key);
                    return (
                      <label key={key} className={empty ? 'is-empty' : ''}>
                        <input type="checkbox" checked={Boolean(selected?.has(key))} onChange={() => toggle(key)} />
                        <span>{CAREER_SECTION_LABELS[key]}</span>
                        <small>{empty ? 'Nothing saved yet' : key === 'summary' || key === 'personal' ? 'Ready' : `${count} ${count === 1 ? 'item' : 'items'}`}</small>
                      </label>
                    );
                  })}
                </fieldset>
              </>
            )}
          </>
        )}

        {source === 'cv' && (
          <>
            {cvError ? (
              <p className="dash-error" role="alert">
                {cvError}
              </p>
            ) : !cvList ? (
              <p role="status">Loading your CVs…</p>
            ) : cvList.length === 0 ? (
              <p className="adv-cv-import-note is-warning" role="status">
                <AlertTriangle size={16} />
                <span>You have no saved CVs yet. Create one in the Advanced CV Builder first.</span>
              </p>
            ) : (
              <>
                <label>
                  Choose a CV to reuse
                  <select aria-label="CV to import from" value={cvId} onChange={(e) => setCvId(e.target.value)}>
                    {cvList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                {cvMeta && (
                  <p className={`adv-cv-import-note ${cvChanged ? 'is-warning' : 'is-ok'}`} role="status">
                    {cvChanged ? <RefreshCw size={16} /> : <CheckCircle2 size={16} />}
                    <span>
                      {cvMeta.projectId !== cvId
                        ? `Currently imported from “${cvMeta.title}”. Importing will switch to the selected CV.`
                        : cvChanged
                        ? `“${cvMeta.title}” has changed since you imported it.`
                        : `Up to date with “${cvMeta.title}”.`}
                    </span>
                  </p>
                )}
                <p className="adv-cv-import-note">
                  <Info size={16} />
                  <span>Name, contact details, summary, skills, experience, education and projects are extracted from the CV’s rendered text, not its source code.</span>
                </p>
              </>
            )}
          </>
        )}

        {needsBackupChoice && (
          <label className="checkbox-label adv-cv-import-backup">
            <input type="checkbox" checked={keepBackup} onChange={(e) => setKeepBackup(e.target.checked)} />
            <span>
              {edited
                ? `You edited ${activeFile} after importing it. Keep a copy of your edits before it is replaced.`
                : `A file named ${activeFile} already exists and will be replaced. Keep a copy of it.`}
            </span>
          </label>
        )}

        {error && (
          <p className="dash-error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="dash-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          {source === 'profile' ? (
            <button type="button" className="button button-primary" disabled={!profile || profileIsEmpty || noSections} onClick={applyProfile}>
              <UserCheck size={16} />
              {isRefresh ? 'Refresh imported information' : 'Import selected sections'}
            </button>
          ) : (
            <button type="button" className="button button-primary" disabled={busy || !selectedCv} onClick={() => void applyCv()}>
              <UserCheck size={16} />
              {busy ? 'Importing…' : isRefresh ? 'Refresh from CV' : 'Import from CV'}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

