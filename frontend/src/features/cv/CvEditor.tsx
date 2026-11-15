import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Code2, Download, FileCode, FileSearch, FolderKanban, History, Printer, Redo2, Save, SearchCheck, Sparkles, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { CvDocument } from '../../document-engine/CvDocument';
import { normalize, sectionLabels, type CvDoc } from '../../document-engine/schema';
import { api, ApiError } from '../../services/api';
import { formatDate, useRefreshWorkspace, type Project } from '../dashboard/data';
import { PanelEditor, type Panel } from './CvForms';

interface DocResponse { project: { id: string; title: string; kind: string }; content: unknown; design: unknown; revision: number }
interface Version { id: number; name: string; revision: number; created_at: string }
interface AtsCheckItem { category: string; status: 'pass' | 'warning'; message: string }
interface AtsResponse { score: number; checks: AtsCheckItem[]; disclaimer: string }
interface ContentFinding { category: string; severity: 'good' | 'warning' | 'info'; message: string }
interface ContentSuggestion { id: string; label: string; section: 'summary' | 'experience'; index?: number; preview: string }
interface ContentAnalysisResponse { findings: ContentFinding[]; suggestions: ContentSuggestion[] }
interface JobMatchResponse { score: number; matched_keywords: string[]; missing_keywords: string[]; recommendations: string[] }
interface FilesResponse { files: Record<'CV.tsx' | 'style.css' | 'cv.json', string> }

type Status = 'saved' | 'unsaved' | 'saving' | 'failed' | 'conflict';
type DialogKind = 'versions' | 'save-version' | 'save-template' | 'ats' | 'analyzer' | 'matcher' | 'import-profile' | 'export' | null;
const statusText: Record<Status, string> = { saved: 'All changes saved', unsaved: 'Unsaved changes…', saving: 'Saving…', failed: 'Save failed', conflict: 'Out of date' };
const panels: Panel[] = ['personal', 'summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'achievements', 'publications', 'languages', 'volunteering', 'references', 'custom', 'design'];
const panelLabel = (p: Panel) => p === 'personal' ? 'Personal Information' : p === 'design' ? 'Design and Layout' : sectionLabels[p];
const vaultSections = [
  { key: 'personal', label: 'Personal Details' },
  { key: 'summary', label: 'Professional Summary' },
  { key: 'experience', label: 'Work Experience' },
  { key: 'education', label: 'Education' },
  { key: 'skills', label: 'Skills' },
  { key: 'projects', label: 'Projects' },
  { key: 'certifications', label: 'Certifications' },
];

export function CvEditor() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const refresh = useRefreshWorkspace();
  const [doc, setDoc] = useState<CvDoc | null>(null);
  const [title, setTitle] = useState('');
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<Status>('saved');
  const [panel, setPanel] = useState<Panel>('personal');
  const [editorMode, setEditorMode] = useState<'guided' | 'code'>('guided');
  const [activeFile, setActiveFile] = useState<'cv.json' | 'CV.tsx' | 'style.css'>('cv.json');
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState('');
  const jsonDirty = useRef(false);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [zoom, setZoom] = useState(0.8);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [versionName, setVersionName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [atsReport, setAtsReport] = useState<AtsResponse | null>(null);
  const [contentReport, setContentReport] = useState<ContentAnalysisResponse | null>(null);
  const [jdText, setJdText] = useState('');
  const [tailoredTitle, setTailoredTitle] = useState('');
  const [jobMatch, setJobMatch] = useState<JobMatchResponse | null>(null);
  const [selectedVaultSections, setSelectedVaultSections] = useState<string[]>(vaultSections.map(s => s.key));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const latest = useRef<CvDoc | null>(null);
  const revision = useRef(0);
  const saving = useRef(false);
  const dirty = useRef(false);
  const blocked = useRef(false);
  const failed = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const past = useRef<CvDoc[]>([]);
  const future = useRef<CvDoc[]>([]);
  const lastPush = useRef(0);
  const savedTitle = useRef('');
  const [, bump] = useState(0);

  const applyLoaded = useCallback((res: DocResponse) => {
    const next = normalize(res);
    latest.current = next; revision.current = res.revision; dirty.current = false; blocked.current = false;
    past.current = []; future.current = [];
    jsonDirty.current = false;
    setDoc(next); setJsonDraft(JSON.stringify(next, null, 2)); setJsonError('');
    setTitle(res.project.title); savedTitle.current = res.project.title; setStatus('saved');
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError('');
    try { applyLoaded(await api<DocResponse>(`/projects/${projectId}/document/`, { signal })); }
    catch (err) {
      if ((err as Error).name === 'AbortError' || signal?.aborted) return;
      setLoadError((err as Error).message);
    }
  }, [projectId, applyLoaded]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => { controller.abort(); window.clearTimeout(timer.current); };
  }, [load]);

  const flush = useCallback(async () => {
    if (saving.current || !dirty.current || blocked.current || !latest.current) return;
    failed.current = false; saving.current = true; dirty.current = false; setStatus('saving');
    const snapshot = latest.current;
    try {
      const res = await api<DocResponse>(`/projects/${projectId}/document/`, { method: 'PUT', body: JSON.stringify({ content: snapshot.content, design: snapshot.design, revision: revision.current }) });
      revision.current = res.revision;
      setStatus(dirty.current ? 'unsaved' : 'saved');
      void refresh();
    } catch (err) {
      dirty.current = true;
      if (err instanceof ApiError && err.status === 409) { blocked.current = true; setStatus('conflict'); } else { failed.current = true; setStatus('failed'); }
    } finally {
      saving.current = false;
      if (dirty.current && !blocked.current && !failed.current) timer.current = window.setTimeout(() => void flush(), 1500);
    }
  }, [projectId, refresh]);

  const queueSave = useCallback(() => {
    dirty.current = true; failed.current = false;
    if (!blocked.current) setStatus(s => (s === 'saving' ? s : 'unsaved'));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 1500);
  }, [flush]);

  const update = useCallback((fn: (d: CvDoc) => CvDoc) => {
    if (!latest.current || blocked.current) return;
    const now = Date.now();
    if (now - lastPush.current > 700) { past.current.push(latest.current); if (past.current.length > 100) past.current.shift(); }
    lastPush.current = now; future.current = [];
    latest.current = fn(latest.current);
    setDoc(latest.current);
    if (!jsonDirty.current) setJsonDraft(JSON.stringify(latest.current, null, 2));
    queueSave();
  }, [queueSave]);

  function travel(from: React.MutableRefObject<CvDoc[]>, to: React.MutableRefObject<CvDoc[]>) {
    const target = from.current.pop();
    if (!target || !latest.current) return;
    to.current.push(latest.current); latest.current = target; lastPush.current = 0; setDoc(target);
    if (!jsonDirty.current) setJsonDraft(JSON.stringify(target, null, 2));
    queueSave(); bump(n => n + 1);
  }

  useEffect(() => {
    function warn(e: BeforeUnloadEvent) { if (dirty.current || saving.current || jsonDirty.current) { e.preventDefault(); e.returnValue = ''; } }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  async function ensureFlushed() {
    if (jsonDirty.current) throw new Error('Apply or reset your cv.json changes first.');
    window.clearTimeout(timer.current);
    while (saving.current) await new Promise(r => setTimeout(r, 50));
    await flush();
    if (dirty.current || blocked.current) throw new Error('Save your latest changes successfully before continuing.');
  }

  async function chooseTemplate() {
    setMessage(''); setBusy(true);
    try { await ensureFlushed(); navigate(`/dashboard/cv-templates?project=${projectId}&revision=${revision.current}`); }
    catch (err) { setMessage((err as Error).message); }
    finally { setBusy(false); }
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try {
      await ensureFlushed();
      await api('/my-templates/', { method: 'POST', body: JSON.stringify({ name: templateName.trim(), design: latest.current!.design }) });
      setDialog(null); setTemplateName(''); setMessage('Template saved in My Templates.'); void refresh();
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }

  async function exportDocument(format: 'pdf' | 'docx' | 'zip') {
    if (busy) return; setBusy(true); setMessage('');
    try {
      await ensureFlushed();
      const { buildDocx, downloadBlob, printCv } = await import('../../document-engine/exports');
      const filename = title.replace(/[^a-zA-Z0-9_-]/g, '-') || 'cv';
      if (format === 'pdf') await printCv(latest.current!);
      else if (format === 'docx') downloadBlob(new Blob([await buildDocx(latest.current!, title)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${filename}.docx`);
      else {
        const res = await fetch(`/api/projects/${projectId}/export/zip/`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Unable to download the source package. Please try again.');
        downloadBlob(await res.blob(), `${filename}.zip`);
      }
      setDialog(null);
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }

  async function renameProject() {
    const next = title.trim();
    if (!next) { setTitle(savedTitle.current); return; }
    if (next === savedTitle.current) return;
    try { await api(`/projects/${projectId}/`, { method: 'PATCH', body: JSON.stringify({ title: next }) }); savedTitle.current = next; setTitle(next); setMessage('Project renamed.'); void refresh(); }
    catch (err) { setMessage((err as Error).message); setTitle(savedTitle.current); }
  }

  async function switchToCodeMode() {
    setEditorMode('code');
    if (latest.current && !jsonDirty.current) setJsonDraft(JSON.stringify(latest.current, null, 2));
    try {
      await ensureFlushed();
      const res = await api<FilesResponse>(`/projects/${projectId}/files/`);
      setProjectFiles(res.files);
    } catch {
      // Fallback to local representation if offline
    }
  }

  function applyJsonDraft() {
    if (blocked.current) return;
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonDraft) as { content?: unknown; design?: unknown };
      const normalized = normalize(parsed);
      jsonDirty.current = false;
      update(() => normalized);
      setMessage('Applied cv.json changes to CV.');
    } catch (err) {
      setJsonError(`Invalid JSON: ${(err as Error).message}`);
    }
  }

  async function openVersions() {
    setDialog('versions'); setVersions(null); setMessage('');
    try { setVersions(await api<Version[]>(`/projects/${projectId}/versions/`)); } catch (err) { setMessage((err as Error).message); setVersions([]); }
  }
  async function saveVersion(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      await ensureFlushed();
      if (dirty.current) throw new Error('Your latest changes could not be saved, so no version was created. Retry saving first.');
      await api(`/projects/${projectId}/versions/`, { method: 'POST', body: JSON.stringify({ name: versionName }) });
      setDialog(null); setVersionName(''); setMessage('Version saved.');
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }
  async function restore(version: Version) {
    setBusy(true); setMessage('');
    try { applyLoaded(await api<DocResponse>(`/projects/${projectId}/versions/${version.id}/restore/`, { method: 'POST' })); setDialog(null); setMessage(`Restored “${version.name}”.`); void refresh(); }
    catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }

  async function openAtsChecker() {
    setDialog('ats'); setAtsReport(null); setMessage('');
    try {
      await ensureFlushed();
      setAtsReport(await api<AtsResponse>(`/projects/${projectId}/ats-check/`));
    } catch (err) { setMessage((err as Error).message); }
  }

  async function openContentAnalyzer() {
    setDialog('analyzer'); setContentReport(null); setMessage('');
    try {
      await ensureFlushed();
      setContentReport(await api<ContentAnalysisResponse>(`/projects/${projectId}/content-analysis/`));
    } catch (err) { setMessage((err as Error).message); }
  }

  function applySuggestion(s: ContentSuggestion) {
    if (s.section === 'summary') {
      update(d => ({ ...d, content: { ...d.content, summary: s.preview } }));
    } else if (s.section === 'experience' && typeof s.index === 'number') {
      update(d => ({
        ...d,
        content: {
          ...d.content,
          experience: d.content.experience.map((item, idx) => idx === s.index ? { ...item, description: s.preview } : item),
        },
      }));
    }
    setMessage(`Applied suggestion: ${s.label}`);
  }

  async function runJobMatcher(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      await ensureFlushed();
      const res = await api<JobMatchResponse>(`/projects/${projectId}/job-match/`, { method: 'POST', body: JSON.stringify({ job_description: jdText }) });
      setJobMatch(res);
      if (!tailoredTitle) setTailoredTitle(`${title} (Tailored)`);
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }

  async function createTailoredCopy() {
    setBusy(true); setMessage('');
    try {
      await ensureFlushed();
      const created = await api<Project>(`/projects/${projectId}/tailored-cv/`, {
        method: 'POST',
        body: JSON.stringify({ job_description: jdText, title: tailoredTitle || `${title} (Tailored)` }),
      });
      setDialog(null);
      void refresh();
      navigate(`/dashboard/advanced-cv/${created.id}`);
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }

  async function importFromProfile(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      await ensureFlushed();
      const res = await api<DocResponse>(`/projects/${projectId}/import-profile/`, {
        method: 'POST',
        body: JSON.stringify({ sections: selectedVaultSections }),
      });
      applyLoaded(res);
      setDialog(null);
      setMessage('Imported selected sections from Career Profile Vault.');
      void refresh();
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }

  if (loadError) return <section className="dash-panel"><h1>Unable to open this CV</h1><p className="dash-error" role="alert">{loadError}</p><div className="dialog-actions"><button className="dash-secondary" onClick={() => void load()}>Try again</button><Link className="button button-primary" to="/dashboard/advanced-cv">Back to Advanced CVs</Link></div></section>;
  if (!doc) return <div className="dash-skeleton" role="status" aria-label="Loading CV"><span /><span /><span /></div>;

  return (
    <div className="cv-workspace">
      <div className="cv-toolbar">
        <Link className="dash-secondary" to="/dashboard/projects"><ArrowLeft size={16} />Back to Projects</Link>
        <label className="cv-title-field"><span className="sr-only">Project name</span><input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} onBlur={() => void renameProject()} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
        <span className={`cv-status is-${jsonDirty.current ? 'unsaved' : status}`} role="status">{jsonDirty.current && status === 'saved' ? 'Unapplied JSON changes' : statusText[status]}</span>
        {status === 'failed' && <button className="dash-link" onClick={() => void flush()}>Retry save</button>}
        {status === 'conflict' && <button className="dash-link" onClick={() => void load()}>Load latest version</button>}
        <div className="cv-toolbar-actions">
          <button className="dash-icon-button" aria-label="Undo" disabled={past.current.length === 0 || status === 'conflict'} onClick={() => travel(past, future)}><Undo2 size={17} /></button>
          <button className="dash-icon-button" aria-label="Redo" disabled={future.current.length === 0 || status === 'conflict'} onClick={() => travel(future, past)}><Redo2 size={17} /></button>
          <button className="dash-secondary" onClick={() => { setMessage(''); setDialog('import-profile'); }}><Sparkles size={16} />Import Profile</button>
          <button className="dash-secondary" onClick={() => { setMessage(''); setDialog('save-version'); }}><Save size={16} />Save Version</button>
          <button className="dash-secondary" disabled={busy} onClick={() => void chooseTemplate()}>Change Template</button>
          <button className="dash-secondary" onClick={() => { setMessage(''); setDialog('save-template'); }}>Save as Template</button>
          <button className="dash-secondary" onClick={() => void openVersions()}><History size={16} />Version History</button>
          <button className="dash-secondary" onClick={() => void openAtsChecker()}><SearchCheck size={16} />ATS Checker</button>
          <button className="dash-secondary" onClick={() => void openContentAnalyzer()}><BarChart3 size={16} />Content Analyzer</button>
          <button className="dash-secondary" onClick={() => { setMessage(''); setJobMatch(null); setDialog('matcher'); }}><FileSearch size={16} />Job Matcher</button>
          <button className="dash-secondary" onClick={() => { setMessage(''); setDialog('export'); }}><Download size={16} />Export</button>
        </div>
      </div>
      {message && <p className="dash-toast" role="status">{message}</p>}
      {status === 'conflict' && <p className="dash-error" role="alert">This CV was changed in another tab or session. Editing is paused so newer work is not overwritten.</p>}

      <div className="cv-tabs" role="tablist" aria-label="Workspace view">
        <button role="tab" aria-selected={mobileTab === 'edit'} className={mobileTab === 'edit' ? 'is-active' : ''} onClick={() => setMobileTab('edit')}>Edit</button>
        <button role="tab" aria-selected={mobileTab === 'preview'} className={mobileTab === 'preview' ? 'is-active' : ''} onClick={() => setMobileTab('preview')}>Preview</button>
      </div>

      <div className="cv-layout" data-tab={mobileTab}>
        <nav className="cv-sections" aria-label="CV sections">
          <div className="cv-mode-switch" role="group" aria-label="Editor mode">
            <button type="button" className={editorMode === 'guided' ? 'is-active' : ''} onClick={() => setEditorMode('guided')}><FolderKanban size={15} />Guided &amp; Visual</button>
            <button type="button" className={editorMode === 'code' ? 'is-active' : ''} onClick={() => void switchToCodeMode()}><Code2 size={15} />Files &amp; Code</button>
          </div>
          {editorMode === 'guided' ? (
            panels.map(p => <button key={p} className={panel === p ? 'is-active' : ''} aria-current={panel === p} onClick={() => setPanel(p)}>{panelLabel(p)}</button>)
          ) : (
            <>
              <span className="cv-hint">Project File Explorer</span>
              {(['cv.json', 'CV.tsx', 'style.css'] as const).map(fname => (
                <button key={fname} className={activeFile === fname ? 'is-active' : ''} onClick={() => setActiveFile(fname)}>
                  <FileCode size={15} /> {fname}
                </button>
              ))}
              <p className="cv-hint">React and CSS source editing is not implemented yet. Edit cv.json, then apply changes to save your CV.</p>
            </>
          )}
        </nav>

        <section className="cv-edit-panel" aria-label={editorMode === 'guided' ? panelLabel(panel) : `File ${activeFile}`}>
          {editorMode === 'guided' ? (
            <>
              <h2>{panelLabel(panel)}</h2>
              <PanelEditor panel={panel} doc={doc} update={update} />
            </>
          ) : (
            <div className="cv-form-body">
              <h2>{activeFile}</h2>
              {activeFile === 'cv.json' ? (
                <>
                  {jsonError && <p className="dash-error" role="alert">{jsonError}</p>}
                  <p className="cv-hint">JSON edits remain a draft until you select Apply cv.json changes. Then wait for All changes saved before leaving.</p>
                  <label className="cv-field">
                    <span>Structured CV Data (cv.json)</span>
                    <textarea
                      aria-label="cv.json code editor"
                      className="cv-code-textarea"
                      rows={18}
                      value={jsonDraft}
                      onChange={e => { jsonDirty.current = true; setJsonDraft(e.target.value); setJsonError(''); }}
                    />
                  </label>
                  <div className="cv-entry-actions">
                    <button type="button" className="button button-primary" disabled={status === 'conflict'} onClick={applyJsonDraft}>Apply cv.json changes</button>
                    <button type="button" className="dash-secondary" onClick={() => { jsonDirty.current = false; setJsonDraft(JSON.stringify(doc, null, 2)); setJsonError(''); }}>Reset</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="cv-hint">Read-only generated source file ({activeFile}). Export as ZIP to customize locally in a full React environment.</p>
                  <textarea
                    aria-label={`${activeFile} source`}
                    className="cv-code-textarea"
                    rows={18}
                    readOnly
                    value={projectFiles[activeFile] || '// Loading file...'}
                  />
                </>
              )}
            </div>
          )}
        </section>

        <section className="cv-preview-panel" aria-label="Live preview">
          <div className="cv-preview-toolbar">
            <strong>Live Preview · {doc.design.pageSize === 'A4' ? 'A4' : 'US Letter'}</strong>
            <span><button className="dash-icon-button" aria-label="Zoom out" disabled={zoom <= 0.4} onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(1)))}><ZoomOut size={16} /></button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button className="dash-icon-button" aria-label="Zoom in" disabled={zoom >= 1.4} onClick={() => setZoom(z => Math.min(1.4, +(z + 0.1).toFixed(1)))}><ZoomIn size={16} /></button></span>
          </div>
          <div className="cv-preview-scroll"><CvDocument doc={doc} zoom={zoom} /></div>
        </section>
      </div>

      {dialog === 'save-template' && <Dialog title="Save as Template" onClose={() => { if (!busy) setDialog(null); }}>
        <form className="dash-form" onSubmit={e => void saveTemplate(e)}>
          <p>Save this design privately for reuse. Your CV content is not included.</p>
          {message && <p className="dash-error" role="alert">{message}</p>}
          <label>Template name<input required maxLength={120} value={templateName} onChange={e => setTemplateName(e.target.value)} disabled={busy} /></label>
          <div className="dialog-actions"><button type="button" className="dash-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="button button-primary" disabled={busy || !templateName.trim()}>Save template</button></div>
        </form>
      </Dialog>}

      {dialog === 'save-version' && <Dialog title="Save version" onClose={() => { if (!busy) setDialog(null); }}>
        <form className="dash-form" onSubmit={e => void saveVersion(e)}>
          {message && <p className="dash-error" role="alert">{message}</p>}
          <label>Version name<input value={versionName} maxLength={120} placeholder="For example: Sent to Acme" onChange={e => setVersionName(e.target.value)} disabled={busy} /></label>
          <div className="dialog-actions"><button type="button" className="dash-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save version'}</button></div>
        </form>
      </Dialog>}

      {dialog === 'versions' && <Dialog title="Version history" onClose={() => { if (!busy) setDialog(null); }}>
        {message && <p className="dash-error" role="alert">{message}</p>}
        {versions === null ? <div className="dash-skeleton" role="status" aria-label="Loading versions"><span /><span /></div> : versions.length === 0 ? <p className="dash-dialog-lead">No saved versions yet. Use Save Version to keep a named snapshot.</p> : <ul className="cv-version-list">{versions.map(v => <li key={v.id}><div><strong>{v.name}</strong><time dateTime={v.created_at}>{formatDate(v.created_at)}</time></div><button className="dash-secondary" disabled={busy || status !== 'saved'} title={status !== 'saved' ? 'Wait for saving to finish' : undefined} onClick={() => void restore(v)}>Restore</button></li>)}</ul>}
        <p className="cv-hint">Restoring creates a new revision and keeps your current version in history.</p>
      </Dialog>}

      {dialog === 'ats' && <Dialog title="ATS Checker" onClose={() => setDialog(null)}>
        {!atsReport ? <div className="dash-skeleton" role="status" aria-label="Running ATS check"><span /><span /></div> : (
          <div className="cv-form-body">
            <div className="cv-score-banner">
              <strong>ATS Readiness Score: {atsReport.score}%</strong>
              <p className="cv-hint">{atsReport.disclaimer}</p>
            </div>
            <ul className="cv-version-list">
              {atsReport.checks.map(c => (
                <li key={c.category}>
                  <div>
                    <strong>{c.category} ({c.status === 'pass' ? 'Pass' : 'Needs attention'})</strong>
                    <p className="cv-hint">{c.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>}

      {dialog === 'analyzer' && <Dialog title="CV Content Analyzer" onClose={() => setDialog(null)}>
        {!contentReport ? <div className="dash-skeleton" role="status" aria-label="Analyzing content"><span /><span /></div> : (
          <div className="cv-form-body">
            <h3 className="cv-subheading">Findings</h3>
            <ul className="cv-version-list">
              {contentReport.findings.map(f => (
                <li key={f.category}>
                  <div>
                    <strong>{f.category}</strong>
                    <p className="cv-hint">{f.message}</p>
                  </div>
                </li>
              ))}
            </ul>
            {contentReport.suggestions.length > 0 && (
              <>
                <h3 className="cv-subheading">Suggested Improvements</h3>
                <ul className="cv-version-list">
                  {contentReport.suggestions.map(s => (
                    <li key={s.id}>
                      <div>
                        <strong>{s.label}</strong>
                        <p className="cv-hint">“{s.preview}”</p>
                      </div>
                      <button type="button" className="dash-secondary" onClick={() => applySuggestion(s)}>Apply</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Dialog>}

      {dialog === 'matcher' && <Dialog title="Job Description Matcher" onClose={() => { if (!busy) setDialog(null); }}>
        <form className="dash-form" onSubmit={e => void runJobMatcher(e)}>
          {message && <p className="dash-error" role="alert">{message}</p>}
          <label>
            Paste job description
            <textarea rows={5} required value={jdText} placeholder="Paste the target role responsibilities and requirements here..." onChange={e => setJdText(e.target.value)} disabled={busy} />
          </label>
          <div className="dialog-actions">
            <button type="submit" className="button button-primary" disabled={busy || jdText.trim().length < 20}>{busy ? 'Comparing…' : 'Compare with CV'}</button>
          </div>
        </form>
        {jobMatch && (
          <div className="cv-form-body" style={{ marginTop: 14 }}>
            <div className="cv-score-banner">
              <strong>Keyword Match Score: {jobMatch.score}%</strong>
              <p className="cv-hint">Matched ({jobMatch.matched_keywords.length}): {jobMatch.matched_keywords.join(', ') || 'None'}</p>
              <p className="cv-hint">Missing ({jobMatch.missing_keywords.length}): {jobMatch.missing_keywords.join(', ') || 'None'}</p>
            </div>
            {jobMatch.recommendations.map((rec, i) => <p key={i} className="cv-hint">{rec}</p>)}
            <label className="cv-field">
              <span>New targeted CV project title</span>
              <input value={tailoredTitle} onChange={e => setTailoredTitle(e.target.value)} disabled={busy} />
            </label>
            <button type="button" className="button button-primary" disabled={busy} onClick={() => void createTailoredCopy()}>
              Create Targeted CV Copy
            </button>
            <p className="cv-hint">Creates a separate CV project with aligned skills without overwriting your current CV.</p>
          </div>
        )}
      </Dialog>}

      {dialog === 'import-profile' && <Dialog title="Import from Career Profile Vault" onClose={() => { if (!busy) setDialog(null); }}>
        <form className="dash-form" onSubmit={e => void importFromProfile(e)}>
          <p className="dash-dialog-lead">Select which sections from your Career Profile Vault to merge into this CV:</p>
          <ul className="cv-order-list">
            {vaultSections.map(s => (
              <li key={s.key}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedVaultSections.includes(s.key)}
                    onChange={e => setSelectedVaultSections(prev => e.target.checked ? [...prev, s.key] : prev.filter(k => k !== s.key))}
                  />{' '}
                  {s.label}
                </label>
              </li>
            ))}
          </ul>
          <div className="dialog-actions">
            <button type="button" className="dash-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={busy || selectedVaultSections.length === 0}>{busy ? 'Importing…' : 'Import Selected'}</button>
          </div>
        </form>
      </Dialog>}

      {dialog === 'export' && <Dialog title="Export CV" onClose={() => setDialog(null)}>
        <div className="cv-form-body">
          <p className="dash-dialog-lead">Export your saved CV:</p>
          {message && <p className="dash-error" role="alert">{message}</p>}
          <div className="cv-entry-actions">
            <button type="button" className="button button-primary" disabled={busy} onClick={() => void exportDocument('pdf')}>
              <Printer size={16} />Print / Save Selectable PDF
            </button>
            <button type="button" className="dash-secondary" disabled={busy} onClick={() => void exportDocument('docx')}>Download Editable DOCX</button>
            <button type="button" className="dash-secondary" disabled={busy} onClick={() => void exportDocument('zip')}>
              <Download size={16} />Download React Source ZIP (CV.tsx, style.css, cv.json)
            </button>
          </div>
          <p className="cv-hint">PDF keeps the React layout. DOCX preserves visible text, fonts, colours, headings and links in a single-column Word layout; decorative banners and columns are simplified.</p>
          <button className="dash-secondary" disabled>Create Matching Cover Letter — planned</button>
        </div>
      </Dialog>}
    </div>
  );
}
