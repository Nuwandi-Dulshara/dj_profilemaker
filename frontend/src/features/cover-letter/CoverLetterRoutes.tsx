import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Copy, Database, FileText, Link2, Mail, Sparkles } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { QueryState } from '../dashboard/QueryState';
import { formatDate, useRefreshWorkspace, useWorkspace, type Project, type ProjectsResponse } from '../dashboard/data';
import { useSession } from '../auth/AuthProvider';
import './cover-letter.css';

interface CoverLetterApplicant {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
}

interface CoverLetterRecipient {
  company: string;
  hiringManager: string;
  jobTitle: string;
  department: string;
  reference: string;
  date: string;
}

interface CoverLetterBody {
  greeting: string;
  opening: string;
  experience: string;
  skills: string;
  company: string;
  value: string;
  closing: string;
  signOff: string;
  signature: string;
}

export interface CoverLetterContent {
  applicant: CoverLetterApplicant;
  recipient: CoverLetterRecipient;
  letter: CoverLetterBody;
  linkedCvId: string | null;
  template: string;
}

interface CoverLetterDocument {
  project: { id: string; title: string; kind: string };
  content: CoverLetterContent;
  design: Record<string, unknown>;
  revision: number;
  schema_version: number;
}

function defaultDesign() {
  return {
    pageSize: 'A4',
    fontFamily: 'Georgia',
    fontSize: 11,
    accent: '#0B1F3A',
    margin: 18,
    lineHeight: 1.5,
    textColor: '#111827',
    headerStyle: 'left',
    layout: 'single',
    templateId: 'classic-professional',
    alignment: 'left',
    sectionSpacing: 1.2,
  };
}

function defaultContent(seed: Partial<CoverLetterApplicant> = {}): CoverLetterContent {
  const today = new Date().toISOString().slice(0, 10);
  return {
    applicant: {
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      portfolio: '',
      ...seed,
    },
    recipient: {
      company: '',
      hiringManager: '',
      jobTitle: '',
      department: '',
      reference: '',
      date: today,
    },
    letter: {
      greeting: 'Dear Hiring Manager,',
      opening: 'I am excited to apply for the position of {{jobTitle}} at {{company}}. I am particularly drawn to the opportunity because it aligns closely with my experience in delivering measurable results and partnering with cross-functional teams.',
      experience: 'In my recent work, I have led initiatives that improved delivery quality, streamlined workflows, and supported strong business outcomes across customer, team, and stakeholder priorities.',
      skills: 'My background includes project leadership, stakeholder communication, process improvement, and hands-on execution in fast-paced environments where clear priorities and reliable delivery matter.',
      company: 'I admire how {{company}} focuses on {{department}} and professional growth, and I would welcome the opportunity to contribute to that mission.',
      value: 'I would bring a practical, collaborative approach, clear communication, and a strong commitment to solving meaningful problems while supporting team goals and customer outcomes.',
      closing: 'Thank you for your time and consideration. I would welcome the opportunity to discuss how my experience and approach could support {{company}}.',
      signOff: 'Sincerely,',
      signature: '',
    },
    linkedCvId: null,
    template: 'Classic Professional',
  };
}

function blankProjectTitle(name: string) {
  return name.trim() || 'Untitled cover letter';
}

function buildPlainText(content: CoverLetterContent) {
  const lines = [
    content.applicant.name,
    `${content.applicant.email}${content.applicant.phone ? ` | ${content.applicant.phone}` : ''}`,
    content.applicant.location,
    content.applicant.linkedin ? `LinkedIn: ${content.applicant.linkedin}` : '',
    content.applicant.portfolio ? `Portfolio: ${content.applicant.portfolio}` : '',
    '',
    `To: ${content.recipient.hiringManager || 'Hiring Manager'} at ${content.recipient.company || 'Company'}`,
    `Role: ${content.recipient.jobTitle || 'Position'}`,
    `Department: ${content.recipient.department || 'Department'}`,
    `Reference: ${content.recipient.reference || 'Open application'}`,
    `Date: ${content.recipient.date || new Date().toISOString().slice(0, 10)}`,
    '',
    content.letter.greeting,
    '',
    content.letter.opening,
    '',
    content.letter.experience,
    '',
    content.letter.skills,
    '',
    content.letter.company,
    '',
    content.letter.value,
    '',
    content.letter.closing,
    '',
    content.letter.signOff,
    '',
    content.letter.signature,
  ].filter((line) => line !== '');
  return lines.join('\n');
}

function CoverLetterLanding() {
  const recent = useWorkspace<ProjectsResponse>('projects-cover-letter', '/projects/?kind=cover_letter&state=active&page_size=6');
  const choices = [
    { to: '/dashboard/cover-letters/new?mode=blank', icon: FileText, title: 'Start from Blank', text: 'Draft a fresh cover letter with your own structure and wording.', enabled: true },
    { to: '/dashboard/cover-letters/new?mode=template', icon: Sparkles, title: 'Choose Cover Letter Template', text: 'Pick a clean layout and adapt it to the role you are targeting.', enabled: true },
    { to: '/dashboard/cover-letters/new?mode=cv', icon: Link2, title: 'Create from Existing CV', text: 'Import details from your recent CV and personalize the letter.', enabled: true },
  ];

  return (
    <div className="cover-letter-workspace">
      <div className="dash-page-header">
        <div>
          <span className="eyebrow">COVER LETTER BUILDER</span>
          <h1>Cover Letters</h1>
          <p className="dash-subtitle">Create targeted letters, maintain the same project ownership model, and reuse your career data safely.</p>
        </div>
      </div>

      <section className="dash-panel" aria-label="Create a cover letter">
        <div className="dash-panel-header">
          <div>
            <h2>Create New Cover Letter</h2>
          </div>
        </div>
        <div className="quick-actions-grid">
          {choices.map((choice) => {
            const Icon = choice.icon;
            return choice.enabled ? (
              <Link key={choice.title} to={choice.to} className="quick-action-card">
                <span className="quick-action-icon"><Icon size={22} /></span>
                <div>
                  <strong>{choice.title}</strong>
                  <span>{choice.text}</span>
                </div>
                <ArrowRight size={18} />
              </Link>
            ) : (
              <button key={choice.title} type="button" className="quick-action-card" disabled title="Coming soon">
                <span className="quick-action-icon"><Icon size={22} /></span>
                <div>
                  <strong>{choice.title}</strong>
                  <span>{choice.text}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="dash-panel" aria-label="Recent cover letters">
        <div className="dash-panel-header">
          <div><h2><Mail size={18} />Recent Cover Letters</h2></div>
        </div>
        <QueryState pending={recent.isPending} error={recent.error} retry={recent.refetch}>
          {recent.data?.results.length === 0 ? (
            <div className="dash-empty">
              <FileText size={32} />
              <h3>No cover letters yet</h3>
              <p>Create your first job-targeted letter above.</p>
            </div>
          ) : (
            <div className="project-list">
              {recent.data?.results.map((item: Project) => (
                <article key={item.id} className="project-row">
                  <span className="project-icon"><FileText size={22} /></span>
                  <div className="project-details">
                    <h3>{item.title}</h3>
                    <time dateTime={item.updated_at}>Edited {formatDate(item.updated_at)}</time>
                  </div>
                  <Link className="dash-secondary" to={`/dashboard/cover-letters/${item.id}`}>Continue Editing</Link>
                </article>
              ))}
            </div>
          )}
        </QueryState>
      </section>
    </div>
  );
}

function CoverLetterNew() {
  const navigate = useNavigate();
  const refresh = useRefreshWorkspace();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'blank';
  const session = useSession();
  const user = session.data?.user;
  const cvQuery = useWorkspace<ProjectsResponse>('cover-letter-cvs', '/projects/?kind=advanced_cv&state=active&page_size=50');
  const [title, setTitle] = useState('Untitled Cover Letter');
  const [selectedCv, setSelectedCv] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const content = defaultContent({
        name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '',
        email: user?.email || '',
      });
      if (mode === 'cv' && selectedCv) {
        content.linkedCvId = selectedCv;
      }
      const project = await api<Project>('/projects/', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'cover_letter',
          title: blankProjectTitle(title),
          content,
          design: defaultDesign(),
        }),
      });
      await refresh();
      navigate(`/dashboard/cover-letters/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <section className="dash-panel cover-letter-new">
      <span className="eyebrow">COVER LETTER BUILDER</span>
      <h1>{mode === 'cv' ? 'Create from Existing CV' : mode === 'template' ? 'Choose a cover letter template' : 'Create a blank cover letter'}</h1>

      <div className="dash-form">
        {error && <p className="dash-error" role="alert">{error}</p>}
        <label>
          Project name
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={pending} maxLength={200} />
        </label>

        {mode === 'cv' && (
          <label>
            Linked CV
            <select value={selectedCv} onChange={(e) => setSelectedCv(e.target.value)} disabled={pending}>
              <option value="">Choose which CV to reference</option>
              {cvQuery.data?.results.map((cv) => (
                <option key={cv.id} value={cv.id}>{cv.title}</option>
              ))}
            </select>
          </label>
        )}

        <div className="dialog-actions">
          <Link className="dash-secondary" to="/dashboard/cover-letters">Cancel</Link>
          <button type="button" className="button button-primary" disabled={pending || (mode === 'cv' && !selectedCv && Boolean(cvQuery.data?.results.length))} onClick={() => void submit()}>
            {pending ? 'Creating…' : 'Create cover letter'}
          </button>
        </div>
      </div>
    </section>
  );
}

function CoverLetterEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'guided' | 'visual' | 'code'>('guided');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const query = useWorkspace<CoverLetterDocument>(`cover-letter-project-${projectId ?? 'new'}`, projectId ? `/projects/${projectId}/document/` : '/projects/');
  const [docState, commitDocState] = useState<CoverLetterDocument | null>(null);
  const latest = useRef<CoverLetterDocument | null>(null);
  const savedContent = useRef('');
  const saving = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const refresh = useRefreshWorkspace();

  const fingerprint = (value: CoverLetterDocument) => JSON.stringify([value.content, value.design]);
  function setDocState(value: CoverLetterDocument) {
    latest.current = value;
    commitDocState(value);
    if (!saving.current && !conflict) setStatus(fingerprint(value) === savedContent.current ? 'saved' : 'idle');
  }

  useEffect(() => {
    if (query.data && !latest.current) {
      latest.current = query.data;
      commitDocState(query.data);
      savedContent.current = fingerprint(query.data);
      setStatus('saved');
    }
  }, [query.data]);

  const doc = docState ?? query.data ?? null;
  const content = doc?.content ?? defaultContent();
  const design = (doc?.design ?? defaultDesign()) as Record<string, unknown>;

  async function saveDocument() {
    const snapshot = latest.current;
    if (!projectId || !snapshot || saving.current || conflict) return false;
    if (fingerprint(snapshot) === savedContent.current) return true;
    saving.current = true;
    setStatus('saving');
    setError('');
    try {
      const result = await api<CoverLetterDocument>(`/projects/${projectId}/document/`, {
        method: 'PUT',
        body: JSON.stringify({
          content: snapshot.content,
          design: snapshot.design,
          revision: snapshot.revision,
        }),
      });
      savedContent.current = fingerprint(snapshot);
      const current = { ...latest.current!, revision: result.revision };
      latest.current = current;
      commitDocState(current);
      const clean = fingerprint(current) === savedContent.current;
      setStatus(clean ? 'saved' : 'idle');
      void refresh();
      return clean;
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      return false;
    } finally {
      saving.current = false;
    }
  }

  useEffect(() => {
    if (!docState || status !== 'idle' || conflict || actionPending) return;
    const timer = window.setTimeout(() => { void saveDocument(); }, 700);
    return () => window.clearTimeout(timer);
  }, [docState, status, conflict, actionPending]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current && fingerprint(latest.current) !== savedContent.current) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  async function duplicateProject() {
    if (!projectId || actionPending) return;
    setActionPending(true);
    try {
      if (!await saveDocument()) return;
      await api(`/projects/${projectId}/duplicate/`, { method: 'POST' });
      await refresh();
      navigate('/dashboard/cover-letters');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionPending(false);
    }
  }

  async function saveVersion() {
    if (!projectId || actionPending) return;
    setActionPending(true);
    try {
      if (!await saveDocument()) return;
      await api(`/projects/${projectId}/versions/`, { method: 'POST', body: JSON.stringify({ name: doc?.project.title || 'Cover letter version' }) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionPending(false);
    }
  }

  async function downloadText() {
    if (!doc) return;
    const blob = new Blob([buildPlainText(doc.content)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(doc.project.title || 'cover-letter').replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateField(section: 'applicant' | 'recipient' | 'letter', key: string, value: string) {
    if (!doc) return;
    setDocState({
      ...doc,
      content: {
        ...doc.content,
        [section]: {
          ...doc.content[section],
          [key]: value,
        },
      },
    });
  }

  const previewMarkup = useMemo(() => content.applicant && content.recipient && content.letter ? buildPlainText(content) : '', [content]);

  if (!docState) return <QueryState pending={query.isPending} error={query.error} retry={query.refetch}><p>Loading cover letter…</p></QueryState>;
  if (docState.project.kind !== 'cover_letter') return <p role="alert">This project is not a cover letter. Open it from Your Projects.</p>;
  if (!content.applicant || !content.recipient || !content.letter) return <p role="alert">This cover letter has an unsupported content format. Its saved content has not been changed.</p>;

  return (
    <div className="cover-letter-editor">
      <header className="cover-letter-header">
        <div className="cover-letter-header-left">
          <Link className="dash-link" to="/dashboard/cover-letters">← Back to cover letters</Link>
          <div>
            <h1>{doc?.project.title || 'Untitled cover letter'}</h1>
            <small>{status === 'saved' ? 'All changes saved' : status === 'saving' ? 'Saving…' : status === 'error' ? 'Save failed' : 'Unsaved changes'}</small>
          </div>
        </div>
        <div className="cover-letter-header-actions">
          <button type="button" className="dash-secondary" disabled={!doc || status === 'saving' || conflict || actionPending} onClick={() => void saveDocument()}>Save</button>
          <button type="button" className="dash-secondary" disabled={!doc || status === 'saving' || conflict || actionPending} onClick={() => void saveVersion()}>Save Version</button>
          <button type="button" className="dash-secondary" disabled={!doc || status === 'saving' || conflict || actionPending} onClick={() => void duplicateProject()}>Duplicate</button>
          <button type="button" className="button button-primary" onClick={() => void downloadText()}>Download TXT</button>
        </div>
      </header>

      {error && <p className="dash-error" role="alert">{error}</p>}
      {conflict && <p>Your draft is preserved here. Download TXT before reloading to review the latest saved version.</p>}

      <fieldset disabled={actionPending} className="cover-letter-layout" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <aside className="dash-panel cover-letter-panel left-panel">
          <h2>Job details</h2>
          <label>
            Company
            <input value={content.recipient.company} onChange={(e) => updateField('recipient', 'company', e.target.value)} />
          </label>
          <label>
            Hiring manager
            <input value={content.recipient.hiringManager} onChange={(e) => updateField('recipient', 'hiringManager', e.target.value)} />
          </label>
          <label>
            Job title
            <input value={content.recipient.jobTitle} onChange={(e) => updateField('recipient', 'jobTitle', e.target.value)} />
          </label>
          <label>
            Department
            <input value={content.recipient.department} onChange={(e) => updateField('recipient', 'department', e.target.value)} />
          </label>
          <label>
            Job reference
            <input value={content.recipient.reference} onChange={(e) => updateField('recipient', 'reference', e.target.value)} />
          </label>
          <label>
            Application date
            <input type="date" value={content.recipient.date} onChange={(e) => updateField('recipient', 'date', e.target.value)} />
          </label>

          <h3>Linked CV</h3>
          {content.linkedCvId ? (
            <div className="linked-cv-box">
              <CheckCircle2 size={16} />
              <span>Linked to an existing CV</span>
            </div>
          ) : (
            <p className="dash-caption">No CV selected. Use the create flow to link one or import from your Career Profile later.</p>
          )}

          <h3>Design settings</h3>
          <label>
            Font family
            <select value={String(design.fontFamily || 'Georgia')} onChange={(e) => { if (doc) setDocState({ ...doc, design: { ...doc.design, fontFamily: e.target.value } }); }}>
              <option value="Georgia">Georgia</option>
              <option value="Arial">Arial</option>
              <option value="Calibri">Calibri</option>
              <option value="Times New Roman">Times New Roman</option>
            </select>
          </label>
          <label>
            Page size
            <select value={String(design.pageSize || 'A4')} onChange={(e) => { if (doc) setDocState({ ...doc, design: { ...doc.design, pageSize: e.target.value } }); }}>
              <option value="A4">A4</option>
              <option value="Letter">US Letter</option>
            </select>
          </label>
        </aside>

        <main className="dash-panel cover-letter-main-panel">
          <div className="segment-toggle" role="tablist" aria-label="Cover letter editor mode">
            {['guided', 'visual', 'code'].map((tab) => (
              <button key={tab} type="button" className={`segment-button ${mode === tab ? 'is-active' : ''}`} onClick={() => setMode(tab as 'guided' | 'visual' | 'code')}>
                {tab === 'guided' ? 'Guided editor' : tab === 'visual' ? 'Visual editor' : 'Advanced editor'}
              </button>
            ))}
          </div>

          {mode === 'guided' && (
            <div className="letter-form-grid">
              <label>
                Applicant name
                <input value={content.applicant.name} onChange={(e) => updateField('applicant', 'name', e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" value={content.applicant.email} onChange={(e) => updateField('applicant', 'email', e.target.value)} />
              </label>
              <label>
                Phone
                <input value={content.applicant.phone} onChange={(e) => updateField('applicant', 'phone', e.target.value)} />
              </label>
              <label>
                Location
                <input value={content.applicant.location} onChange={(e) => updateField('applicant', 'location', e.target.value)} />
              </label>
              <label>
                LinkedIn
                <input value={content.applicant.linkedin} onChange={(e) => updateField('applicant', 'linkedin', e.target.value)} />
              </label>
              <label>
                Portfolio
                <input value={content.applicant.portfolio} onChange={(e) => updateField('applicant', 'portfolio', e.target.value)} />
              </label>

              <label className="full-width">
                Greeting
                <input value={content.letter.greeting} onChange={(e) => updateField('letter', 'greeting', e.target.value)} />
              </label>
              <label className="full-width">
                Opening paragraph
                <textarea rows={4} value={content.letter.opening} onChange={(e) => updateField('letter', 'opening', e.target.value)} />
              </label>
              <label className="full-width">
                Relevant experience
                <textarea rows={4} value={content.letter.experience} onChange={(e) => updateField('letter', 'experience', e.target.value)} />
              </label>
              <label className="full-width">
                Skills and achievements
                <textarea rows={4} value={content.letter.skills} onChange={(e) => updateField('letter', 'skills', e.target.value)} />
              </label>
              <label className="full-width">
                Why this company
                <textarea rows={3} value={content.letter.company} onChange={(e) => updateField('letter', 'company', e.target.value)} />
              </label>
              <label className="full-width">
                Value proposition
                <textarea rows={3} value={content.letter.value} onChange={(e) => updateField('letter', 'value', e.target.value)} />
              </label>
              <label className="full-width">
                Closing paragraph
                <textarea rows={3} value={content.letter.closing} onChange={(e) => updateField('letter', 'closing', e.target.value)} />
              </label>
              <label className="full-width">
                Sign-off
                <input value={content.letter.signOff} onChange={(e) => updateField('letter', 'signOff', e.target.value)} />
              </label>
              <label className="full-width">
                Signature
                <input value={content.letter.signature} onChange={(e) => updateField('letter', 'signature', e.target.value)} />
              </label>
            </div>
          )}

          {mode === 'visual' && (
            <div className="letter-visual-editor">
              <div className="visual-toolbar">
                <button type="button">Bold</button>
                <button type="button">Italic</button>
                <button type="button">Bulleted list</button>
                <button type="button">Align left</button>
              </div>
              <textarea rows={18} value={previewMarkup} onChange={(e) => {
                if (!doc) return;
                setDocState({
                  ...doc,
                  content: { ...content, letter: { ...content.letter, opening: e.target.value, experience: e.target.value, skills: e.target.value } },
                });
              }} />
            </div>
          )}

          {mode === 'code' && (
            <div className="code-editor-panel">
              <p className="dash-caption">Advanced TSX/CSS customization is intentionally disabled until the secure, isolated preview sandbox is implemented. This keeps arbitrary code execution out of the main workspace.</p>
              <textarea rows={18} value={JSON.stringify({ design, content }, null, 2)} readOnly />
            </div>
          )}
        </main>

        <aside className="dash-panel cover-letter-panel right-panel">
          <div className="cover-letter-preview-head">
            <h2>Live preview</h2>
            <div className="zoom-group">
              <button type="button" className="dash-secondary" onClick={() => { if (doc) setDocState({ ...doc, design: { ...doc.design, fontSize: Number((Number(doc.design.fontSize || 11) * 0.9)).toFixed(1) } }); }}>-</button>
              <span>{Math.round(Number(design.fontSize || 11))}pt</span>
              <button type="button" className="dash-secondary" onClick={() => { if (doc) setDocState({ ...doc, design: { ...doc.design, fontSize: Number((Number(doc.design.fontSize || 11) * 1.1)).toFixed(1) } }); }}>+</button>
            </div>
          </div>
          <article className="letter-preview" style={{ fontFamily: String(design.fontFamily || 'Georgia'), fontSize: `${Number(design.fontSize || 11)}pt`, lineHeight: Number(design.lineHeight || 1.5), color: String(design.textColor || '#111827') }}>
            <header className="letter-preview-header">
              <div>
                <strong>{content.applicant.name || 'Your Name'}</strong>
                <span>{content.applicant.email || 'you@example.com'}</span>
                <span>{content.applicant.phone || 'Phone'}</span>
                <span>{content.applicant.location || 'Location'}</span>
              </div>
            </header>
            <section className="letter-meta">
              <span>{content.recipient.company || 'Company name'}</span>
              <span>{content.recipient.hiringManager || 'Hiring Manager'}</span>
              <span>{content.recipient.jobTitle || 'Target role'}</span>
            </section>
            <div className="letter-body">
              <p>{content.letter.greeting}</p>
              <p>{content.letter.opening}</p>
              <p>{content.letter.experience}</p>
              <p>{content.letter.skills}</p>
              <p>{content.letter.company}</p>
              <p>{content.letter.value}</p>
              <p>{content.letter.closing}</p>
              <p>{content.letter.signOff}</p>
              <p>{content.letter.signature || content.applicant.name || 'Your signature'}</p>
            </div>
          </article>
        </aside>
      </fieldset>
    </div>
  );
}

export function CoverLetterRoutes() {
  return (
    <Routes>
      <Route path="cover-letters" element={<CoverLetterLanding />} />
      <Route path="cover-letters/new" element={<CoverLetterNew />} />
      <Route path="cover-letters/:projectId" element={<CoverLetterEditorRoute />} />
    </Routes>
  );
}

function CoverLetterEditorRoute() {
  const { projectId } = useParams();
  return <CoverLetterEditor key={projectId} />;
}
