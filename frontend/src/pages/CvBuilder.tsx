import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CloudUpload, Code, Download, Eye, Save, Share2 } from 'lucide-react';
import { buildPreview } from '../features/cv/preview';
import {
  cachedPdf, createPdf, downloadPdf, exportPdf, sameSource, saveCv,
} from '../features/cv/integrations';
import { cvApi, cvIntegrations, connectProvider } from '../features/cv/api';
import type { Connections, DriveFile, Provider } from '../features/cv/api';
import type { CvIntegrations, CvPdfCache, CvSource, SavedCv } from '../features/cv/integrations';
import '../features/cv/cv-builder.css';

const emptySource: CvSource = { title: 'Untitled CV', html: '', css: '' };
const leaveMessage = 'Your CV has unsaved changes. Leave and discard them?';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete this action. Please retry.';

export default function CvBuilder({ integrations = cvIntegrations }: { integrations?: CvIntegrations }) {
  const [source, setSource] = useState<CvSource>({ ...emptySource });
  const [saved, setSaved] = useState<SavedCv | null>(null);
  const [view, setView] = useState<'editor' | 'saved'>('editor');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [actionError, setActionError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<CvPdfCache | null>(null);
  const [shareReady, setShareReady] = useState<{ saved: SavedCv; expires: number } | null>(null);
  const [connections, setConnections] = useState<Connections | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPage, setNextPage] = useState<string>();
  const [selectedId, setSelectedId] = useState('');
  const saveLock = useRef(false);
  const actionLock = useRef(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const dirty = !sameSource(source, saved?.source ?? emptySource);
  const deferredSource = useDeferredValue(view === 'saved' && saved ? saved.source : source);
  const documentHtml = useMemo(() => view === 'saved' && saved ? saved.previewHtml : buildPreview(deferredSource), [deferredSource, view, saved]);
  const driveConnected = !!connections?.google.connected;

  async function refreshFiles(pageToken?: string) {
    const result = await cvApi.list(pageToken);
    setFiles(current => pageToken ? [...current, ...result.files] : result.files);
    setNextPage(result.nextPageToken);
  }

  useEffect(() => {
    let active = true;
    cvApi.status().then(async status => {
      if (!active) return;
      setConnections(status);
      if (status.google.connected) {
        const result = await cvApi.list();
        if (active) { setFiles(result.files); setNextPage(result.nextPageToken); }
      }
    }).catch(error => { if (active) setActionError(errorMessage(error)); });
    return () => { active = false; };
  }, []);

  async function connectionAction(provider: Provider, disconnect = false) {
    if (actionLock.current || saveLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setActionError('');
    setConnectionError('');
    try {
      if (disconnect) await cvApi.disconnect(provider); else await connectProvider(provider);
      const status = await cvApi.status();
      setConnections(status);
      if (provider === 'google') {
        setPdf(null);
        if (status.google.connected) await refreshFiles(); else setFiles([]);
      }
      setNotice(disconnect ? 'Cloud connection removed from this session.' : 'Cloud account connected.');
    } catch (error) {
      setConnectionError(errorMessage(error));
      cvApi.status().then(setConnections).catch(() => {});
    } finally { actionLock.current = false; setBusy(false); }
  }

  async function manageDocument(action: 'open' | 'delete' | 'refresh' | 'more') {
    if (actionLock.current || saveLock.current) return;
    if (action === 'open' && dirty && !window.confirm(leaveMessage)) return;
    if (action === 'delete' && (!saved || !window.confirm('Move this saved CV to Google Drive trash? Unsaved edits remain in the editor.'))) return;
    actionLock.current = true;
    setBusy(true);
    setActionError('');
    try {
      if (action === 'open') {
        const loaded = await cvApi.load(selectedId);
        setSource({ ...loaded.source }); setSaved(loaded); setPdf(null); setView('saved'); setSaveError('');
      } else if (action === 'delete' && saved) {
        await cvApi.remove(saved);
        setSaved(null); setPdf(null); setView('editor'); setSelectedId('');
        await refreshFiles();
        setNotice('Saved CV moved to Drive trash. Editor content remains available as a new draft.');
      } else {
        const status = await cvApi.status();
        setConnections(status);
        if (status.google.connected) await refreshFiles(action === 'more' ? nextPage : undefined);
      }
    } catch (error) { setActionError(errorMessage(error)); }
    finally { actionLock.current = false; setBusy(false); }
  }

  function newDocument() {
    if (dirty && !window.confirm(leaveMessage)) return;
    setSource({ ...emptySource }); setSaved(null); setPdf(null); setView('editor'); setSelectedId(''); setSaveError(''); setNotice('');
  }

  useEffect(() => {
    if (!dirty && !saving) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    // Capture existing app links before React Router handles their navigation.
    const onLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
      if (link.href !== window.location.href && !window.confirm(leaveMessage)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onLink, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onLink, true);
    };
  }, [dirty, saving]);

  useEffect(() => {
    if (view === 'saved') previewHeading.current?.focus();
  }, [view]);

  async function handleSave() {
    if (saveLock.current || actionLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const result = await saveCv(integrations, source, saved ?? undefined);
      setSaved(result);
      setPdf(null);
      setActionError('');
      setNotice('');
      setView('saved');
      setSelectedId(result.fileId);
      refreshFiles().catch(error => setNotice(`CV saved; file list refresh failed: ${errorMessage(error)}`));
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function handlePdf(action: 'download' | 'share' | 'drive' | 'onedrive') {
    if (!saved || actionLock.current || saveLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setActionError('');
    setNotice('');
    const filename = `${saved.source.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'CV'}.pdf`;
    try {
      if (action === 'drive' || action === 'onedrive') {
        await exportPdf(action === 'drive' ? integrations.drive?.exportPdf : integrations.oneDrive?.exportPdf, saved);
        setNotice(`PDF exported to ${action === 'drive' ? 'Google Drive' : 'OneDrive'}.`);
        return;
      }
      const existingPdf = action === 'share' && shareReady?.saved === saved && shareReady.expires > Date.now()
        ? cachedPdf(saved, pdf) : null;
      const blob = existingPdf ?? await createPdf(integrations, saved);
      setPdf({ saved, blob });
      if (action === 'download') downloadPdf(blob, filename);
      if (action === 'share') {
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          if (!existingPdf) {
            // File sharing needs a fresh user gesture after asynchronous rendering.
            setNotice('PDF ready. Click Share PDF again to choose a supported app.');
            setShareReady({ saved, expires: Date.now() + 60_000 });
          } else {
            setShareReady(null);
            await navigator.share({ files: [file], title: saved.source.title });
          }
        } else {
          downloadPdf(blob, filename);
          setNotice('File sharing is unavailable on this device. Attach the downloaded PDF manually.');
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setActionError(errorMessage(error));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  const pdfUnavailable = !saved || !driveConnected || !integrations.renderPdf || busy || saving;
  return (
    <main className="container cv-builder">
      <Link className="btn btn-outline" to="/dashboard"><ArrowLeft size={16} /> Back to Dashboard</Link>
      <div className="page-heading cv-heading">
        <div>
          <span className="eyebrow">YOUR DIGITAL WORKSPACE</span>
          <h1>CV Builder</h1>
          <p>Write HTML and CSS, preview your CV, and save the editable source to Google Drive.</p>
        </div>
        <div className="page-actions cv-actions">
          {saved && <button className="btn btn-outline" onClick={() => setView(view === 'editor' ? 'saved' : 'editor')}>
            {view === 'editor' ? <Eye size={16} /> : <Code size={16} />}
            {view === 'editor' ? 'Saved Preview' : 'Edit CV'}
          </button>}
          <button className="btn btn-primary" onClick={handleSave}
            disabled={!driveConnected || !integrations.drive || saving || busy || !source.html.trim() || !source.title.trim()}
            aria-describedby="cv-drive-status">
            <Save size={16} /> {saving ? 'Saving to Google Drive…' : saveError ? 'Retry Google Drive Save' : 'Save to Google Drive'}
          </button>
        </div>
      </div>

      <div className="cv-notice" id="cv-drive-status">
        {connectionError && <p className="cv-error" role="alert">{connectionError}</p>}
        <strong>{driveConnected ? 'Google Drive connected' : 'Connect Google Drive to save your CV'}</strong>
        <p>Editable CV source is saved only to your connected Google Drive. A save is confirmed after retrieving the saved file.</p>
        {connections && !connections.google.configured && <p>Google Drive is not configured yet. Ask the site administrator to enable the connection.</p>}
        <div className="cv-actions">
          <button className="btn btn-outline" disabled={busy || saving || !connections?.google.configured} onClick={() => connectionAction('google')}>{driveConnected ? 'Reconnect Google Drive' : 'Connect Google Drive'}</button>
          {driveConnected && <button className="btn btn-outline" disabled={busy || saving} onClick={() => connectionAction('google', true)}>Disconnect Google Drive</button>}
          <button className="btn btn-outline" disabled={busy || saving} onClick={() => manageDocument('refresh')}>Refresh connections &amp; files</button>
        </div>
        <p>Edits stay in memory only. Reloading or leaving may discard unsaved work. Use Back to Dashboard for a leave warning.</p>
      </div>
      <section className="cv-panel" aria-label="Saved CV files">
        <h2>Saved CVs in Google Drive</h2>
        <div className="cv-actions">
          <select aria-label="Choose a saved CV" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={!driveConnected || busy || saving}>
            <option value="">Choose a CV</option>
            {files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
          </select>
          <button className="btn btn-outline" disabled={!driveConnected || !selectedId || busy || saving} onClick={() => manageDocument('open')}>Open CV</button>
          <button className="btn btn-outline" disabled={busy || saving} onClick={newDocument}>New CV</button>
          <button className="btn btn-outline" disabled={!driveConnected || !saved || busy || saving} onClick={() => manageDocument('delete')}>Delete saved CV</button>
          {nextPage && <button className="btn btn-outline" disabled={busy || saving} onClick={() => manageDocument('more')}>Load more</button>}
        </div>
      </section>
      <p className="cv-status" role="status" aria-live="polite">
        {saving ? 'Waiting for Google Drive confirmation…' : saved
          ? dirty ? 'New changes are unsaved. Saved Preview shows the last confirmed Google Drive version.' : 'Saved to Google Drive.'
          : dirty ? 'Unsaved CV — stored in memory only.' : 'No CV has been saved.'}
      </p>
      {saveError && <p className="cv-error" role="alert">{saveError} Your edits remain here for retry.</p>}

      <div className={`cv-workspace ${view === 'saved' ? 'cv-saved' : ''}`}>
        {view === 'editor' && <section className="cv-panel cv-editor" aria-label="CV source editor">
          <h2><Code size={18} /> CV Code</h2>
          <label htmlFor="cv-title">Document name</label>
          <input id="cv-title" value={source.title} disabled={busy}
            onChange={event => setSource({ ...source, title: event.target.value })} />
          <label htmlFor="cv-html">HTML, CSS &amp; Bootstrap</label>
          <textarea id="cv-html" value={source.html} disabled={busy} spellCheck={false} autoCapitalize="off" autoCorrect="off"
            placeholder="Write or paste a complete HTML document, including CSS in <style> blocks..."
            aria-describedby="cv-html-help cv-bootstrap-help"
            onChange={event => setSource({ ...source, html: event.target.value })} />
          <p id="cv-html-help" className="cv-help">Write a complete HTML document or an HTML fragment in this single editor, with no character or word limit. Include CSS inside &lt;style&gt; blocks. Scripts, forms, embeds and navigation remain disabled. Images must be embedded PNG, JPEG, GIF or WebP data URLs.</p>
          <p id="cv-bootstrap-help" className="cv-help">Bootstrap 5.3.8 CSS is included inside the preview and PDF. Add your CSS in &lt;style&gt; blocks. External resources and Bootstrap JavaScript are disabled.</p>
        </section>}
        <section className="cv-panel cv-preview" aria-label={view === 'saved' ? 'Saved CV preview' : 'Live CV preview'}>
          <h2 ref={previewHeading} tabIndex={-1}><Eye size={18} /> {view === 'saved' ? 'Saved Preview' : 'Live Preview'}</h2>
          <p className="cv-help">A4 page width. Scroll within the preview on smaller screens. PDF output uses print styles and supports page breaks and multiple pages.</p>
          <iframe title={view === 'saved' ? 'Saved CV document' : 'Live CV document'}
            sandbox="" referrerPolicy="no-referrer" srcDoc={documentHtml} />
        </section>
      </div>

      <section className="cv-panel cv-exports" aria-labelledby="cv-export-title">
        <h2 id="cv-export-title">PDF download, sharing &amp; export</h2>
        <p className="cv-help">{!saved ? 'Save to Google Drive first to enable actions on a confirmed saved version. ' : ''}
          {!integrations.renderPdf ? 'CV PDF rendering integration required. The existing profile PDF exporter does not support this isolated preview.' : 'PDF actions use the saved version shown in Saved Preview.'}</p>
        <div className="cv-actions">
          <button className="btn btn-outline" disabled={pdfUnavailable} onClick={() => handlePdf('download')}><Download size={16} /> Download PDF</button>
          <button className="btn btn-outline" disabled={pdfUnavailable} onClick={() => handlePdf('share')}><Share2 size={16} /> Share PDF</button>
        </div>
        <p className="cv-help">Sharing depends on your browser and installed apps. If file sharing is unavailable, download the PDF and attach it manually.</p>
        <div className="cv-clouds">
          <div>
            <h3>Google Drive</h3>
            <p>{integrations.drive?.exportPdf ? 'Export a finished PDF copy.' : 'Connection and PDF upload integration required.'}</p>
            <button className="btn btn-outline" disabled={pdfUnavailable || !integrations.drive?.exportPdf}
              onClick={() => handlePdf('drive')}><CloudUpload size={16} /> Export PDF to Google Drive</button>
          </div>
          <div>
            <h3>OneDrive</h3>
            <button className="btn btn-outline" disabled={busy || saving || !connections?.microsoft.configured} onClick={() => connectionAction('microsoft')}>{connections?.microsoft.connected ? 'Reconnect OneDrive' : 'Connect OneDrive'}</button>
            {connections?.microsoft.connected && <button className="btn btn-outline" disabled={busy || saving} onClick={() => connectionAction('microsoft', true)}>Disconnect OneDrive</button>}
            {connections && !connections.microsoft.configured && <p>Microsoft OAuth configuration is required on the server.</p>}
            <p>{integrations.oneDrive ? 'Export a finished PDF copy only; editable drafts stay in Google Drive.' : 'Connection and PDF upload integration required. PDF copies only; no editable drafts.'}</p>
            <button className="btn btn-outline" disabled={pdfUnavailable || !connections?.microsoft.connected || !integrations.oneDrive}
              onClick={() => handlePdf('onedrive')}><CloudUpload size={16} /> Export PDF to OneDrive</button>
          </div>
        </div>
        {busy && <p role="status">Preparing PDF action…</p>}
        {notice && <p role="status">{notice}</p>}
        {actionError && <p className="cv-error" role="alert">{actionError} Use the action again to retry.</p>}
      </section>
    </main>
  );
}
