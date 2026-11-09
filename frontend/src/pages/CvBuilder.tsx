import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CloudUpload, Code, Download, Eye, Save, Share2 } from 'lucide-react';
import { buildPreview } from '../features/cv/preview';
import {
  cachedPdf, createPdf, cvIntegrations, downloadPdf, exportPdf, sameSource, saveCv,
} from '../features/cv/integrations';
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
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<CvPdfCache | null>(null);
  const saveLock = useRef(false);
  const actionLock = useRef(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const dirty = !sameSource(source, saved?.source ?? emptySource);
  const deferredSource = useDeferredValue(view === 'saved' && saved ? saved.source : source);
  const documentHtml = useMemo(() => buildPreview(deferredSource), [deferredSource]);

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
      const result = await saveCv(integrations, source, saved?.fileId);
      setSaved(result);
      setPdf(null);
      setActionError('');
      setNotice('');
      setView('saved');
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
      const existingPdf = cachedPdf(saved, pdf);
      const blob = existingPdf ?? await createPdf(integrations, saved);
      setPdf({ saved, blob });
      if (action === 'download') downloadPdf(blob, filename);
      if (action === 'share') {
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          if (!existingPdf) {
            // File sharing needs a fresh user gesture after asynchronous rendering.
            setNotice('PDF ready. Click Share PDF again to choose a supported app.');
          } else {
            await navigator.share({ files: [file], title: saved.source.title });
          }
        } else {
          downloadPdf(blob, filename);
          setNotice('File sharing is unavailable on this device. Attach the downloaded PDF manually.');
        }
      }
      if (action === 'drive' || action === 'onedrive') {
        await exportPdf(action === 'drive' ? integrations.drive?.exportPdf : integrations.oneDrive?.exportPdf, blob, filename);
        setNotice(`PDF exported to ${action === 'drive' ? 'Google Drive' : 'OneDrive'}.`);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setActionError(errorMessage(error));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  const pdfUnavailable = !saved || !integrations.renderPdf || busy || saving;
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
            disabled={!integrations.drive || saving || busy || !source.html.trim() || !source.title.trim()}
            aria-describedby="cv-drive-status">
            <Save size={16} /> {saving ? 'Saving to Google Drive…' : saveError ? 'Retry Google Drive Save' : 'Save to Google Drive'}
          </button>
        </div>
      </div>

      <div className="cv-notice" id="cv-drive-status">
        <strong>{integrations.drive ? 'Google Drive source storage' : 'Google Drive connection required — integration not available'}</strong>
        <p>{integrations.drive
          ? 'Editable CV source is saved only to your connected Google Drive after confirmation.'
          : 'This app does not yet have Google Drive authorization or a save API. Saving is unavailable until those are connected.'}</p>
        <p>Edits stay in memory only. Reloading or leaving may discard unsaved work. Use Back to Dashboard for a leave warning.</p>
      </div>
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
          <input id="cv-title" value={source.title} maxLength={120}
            onChange={event => setSource({ ...source, title: event.target.value })} />
          <label htmlFor="cv-html">HTML, CSS &amp; Bootstrap</label>
          <textarea id="cv-html" value={source.html} spellCheck={false} autoCapitalize="off" autoCorrect="off"
            placeholder="Write or paste a complete HTML document, including CSS in <style> blocks..."
            aria-describedby="cv-html-help cv-bootstrap-help"
            onChange={event => setSource({ ...source, html: event.target.value })} />
          <p id="cv-html-help" className="cv-help">Write a complete HTML document or an HTML fragment in this single editor, with no character or word limit. Include CSS inside &lt;style&gt; blocks. Scripts, forms, embeds and navigation remain disabled. Images must be embedded PNG, JPEG, GIF or WebP data URLs.</p>
          <p id="cv-bootstrap-help" className="cv-help">Bootstrap markup and classes are supported. Include the Bootstrap CSS you need in a &lt;style&gt; block in this editor; no Bootstrap stylesheet is installed. External stylesheets and fonts are blocked.</p>
        </section>}
        <section className="cv-panel cv-preview" aria-label={view === 'saved' ? 'Saved CV preview' : 'Live CV preview'}>
          <h2 ref={previewHeading} tabIndex={-1}><Eye size={18} /> {view === 'saved' ? 'Saved Preview' : 'Live Preview'}</h2>
          <p className="cv-help">A4 page width. Scroll within the preview on smaller screens. PDF pagination requires the rendering integration.</p>
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
            <p>{integrations.oneDrive ? 'Export a finished PDF copy only; editable drafts stay in Google Drive.' : 'Connection and PDF upload integration required. PDF copies only; no editable drafts.'}</p>
            <button className="btn btn-outline" disabled={pdfUnavailable || !integrations.oneDrive}
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
