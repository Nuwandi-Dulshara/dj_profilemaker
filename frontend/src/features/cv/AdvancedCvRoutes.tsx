import { useState } from 'react';
import { Link, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookTemplate, Code2, FileText, ListChecks, Sparkles } from 'lucide-react';
import { emptyContent, defaultDesign } from '../../document-engine/schema';
import { api } from '../../services/api';
import { useSession } from '../auth/AuthProvider';
import { formatDate, useRefreshWorkspace, useWorkspace, type Project, type ProjectsResponse } from '../dashboard/data';
import { QueryState } from '../dashboard/QueryState';
import { CvEditor } from './CvEditor';
import './cv.css';

interface CareerVaultPayload {
  personal: Record<string, string>;
  summary: string;
  experience: Record<string, string>[];
  education: Record<string, string>[];
  skills: Record<string, string>[];
  projects: Record<string, string>[];
  certifications: Record<string, string>[];
}

function CvLanding() {
  const recent = useWorkspace<ProjectsResponse>('projects-cv', '/projects/?kind=advanced_cv&state=active&page_size=6');
  const options = [
    { to: '/dashboard/advanced-cv/new?mode=blank', icon: FileText, title: 'Blank CV', text: 'Start with an empty structured CV and fill in each section.', enabled: true },
    { to: '/dashboard/advanced-cv/new?mode=guided', icon: ListChecks, title: 'Guided CV Builder', text: 'Enter your details or import from Career Profile Vault, then continue in the editor.', enabled: true },
    { to: '/dashboard/cv-templates', icon: BookTemplate, title: 'Start from Template', text: 'Browse and customize professional CV layouts.', enabled: true },
  ];
  return (
    <div className="projects-workspace">
      <div className="dash-page-header"><div><span className="eyebrow">ADVANCED CV BUILDER</span><h1>Advanced CV</h1><p className="dash-subtitle">Create a new CV or continue one of your recent projects.</p></div></div>
      <section className="dash-panel" aria-label="Create new CV"><div className="dash-panel-header"><div><h2>Create New CV</h2></div></div>
        <div className="quick-actions-grid">{options.map(o => { const Icon = o.icon; return o.enabled
          ? <Link key={o.title} to={o.to} className="quick-action-card"><span className="quick-action-icon"><Icon size={22} /></span><div><strong>{o.title}</strong><span>{o.text}</span></div><ArrowRight size={18} /></Link>
          : <button key={o.title} className="quick-action-card" disabled title="Not available yet"><span className="quick-action-icon"><Icon size={22} /></span><div><strong>{o.title}</strong><span>{o.text}</span></div></button>; })}</div>
        <p className="dash-caption">Includes live React preview, Project Files &amp; JSON code editor, ATS Checker, Content Analyzer, Job Matcher, and PDF/ZIP export.</p>
      </section>
      <section className="dash-panel" aria-label="Recent Advanced CV projects"><div className="dash-panel-header"><div><h2><Code2 size={19} />Recent Advanced CV Projects</h2></div><Link className="dash-link" to="/dashboard/projects?kind=advanced_cv">View all</Link></div>
        <QueryState pending={recent.isPending} error={recent.error} retry={recent.refetch}>
          {recent.data?.results.length === 0 ? <div className="dash-empty"><FileText size={32} /><h3>No Advanced CVs yet</h3><p>Create your first CV above.</p></div>
            : <div className="project-list">{recent.data?.results.map((p: Project) => <article className="project-row" key={p.id}><span className="project-icon"><FileText size={22} /></span><div className="project-details"><h3>{p.title}</h3><time dateTime={p.updated_at}>Edited {formatDate(p.updated_at)}</time></div><Link className="dash-secondary" to={`/dashboard/advanced-cv/${p.id}`}>Continue Editing</Link></article>)}</div>}
        </QueryState>
      </section>
    </div>
  );
}

function CvNew() {
  const navigate = useNavigate();
  const refresh = useRefreshWorkspace();
  const user = useSession().data?.user;
  const guided = useSearchParams()[0].get('mode') === 'guided';
  const [title, setTitle] = useState('Untitled CV');
  const [seed, setSeed] = useState({ name: [user?.first_name, user?.last_name].filter(Boolean).join(' '), title: '', email: user?.email ?? '', summary: '' });
  const [importVault, setImportVault] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function pullFromVault() {
    setError('');
    try {
      const vault = await api<CareerVaultPayload>('/career-profile/');
      setSeed(prev => ({
        name: vault.personal.name || prev.name,
        title: vault.personal.title || prev.title,
        email: vault.personal.email || prev.email,
        summary: vault.summary || prev.summary,
      }));
      setImportVault(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (pending) return;
    setPending(true); setError('');
    try {
      const content = { ...emptyContent(guided ? { name: seed.name, title: seed.title, email: seed.email } : {}), summary: guided ? seed.summary : '' };
      const project = await api<Project>('/advanced-cv/', { method: 'POST', body: JSON.stringify({ title, content, design: defaultDesign() }) });
      if (guided && importVault) {
        await api(`/projects/${project.id}/import-profile/`, { method: 'POST', body: JSON.stringify({ sections: ['experience', 'education', 'skills', 'projects', 'certifications'] }) });
      }
      void refresh(); navigate(`/dashboard/advanced-cv/${project.id}`);
    } catch (err) { setError((err as Error).message); setPending(false); }
  }
  return (
    <section className="dash-panel cv-new-panel"><span className="eyebrow">ADVANCED CV BUILDER</span><h1>{guided ? 'Guided CV Builder' : 'Create a blank CV'}</h1>
      <form className="dash-form" onSubmit={e => void submit(e)}>
        {error && <p className="dash-error" role="alert">{error}</p>}
        <label>Project name<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} disabled={pending} /></label>
        {guided && <>
          <div className="cv-entry-actions">
            <button type="button" className="dash-secondary" onClick={() => void pullFromVault()} disabled={pending}>
              <Sparkles size={16} />Import from Career Profile Vault
            </button>
            {importVault && <span className="cv-hint">Vault experience, education, skills, projects, and certifications will be imported.</span>}
          </div>
          <label>Full name<input value={seed.name} onChange={e => setSeed({ ...seed, name: e.target.value })} disabled={pending} /></label>
          <label>Professional title<input value={seed.title} onChange={e => setSeed({ ...seed, title: e.target.value })} disabled={pending} /></label>
          <label>Email<input type="email" value={seed.email} onChange={e => setSeed({ ...seed, email: e.target.value })} disabled={pending} /></label>
          <label>Professional summary<textarea rows={4} value={seed.summary} onChange={e => setSeed({ ...seed, summary: e.target.value })} disabled={pending} /></label>
        </>}
        <div className="dialog-actions"><Link className="dash-secondary" to="/dashboard/advanced-cv">Cancel</Link><button className="button button-primary" disabled={pending || !title.trim()}>{pending ? 'Creating…' : 'Create CV'}</button></div>
      </form>
    </section>
  );
}

/** Mounted under /dashboard/*, so paths are relative to /dashboard. */
export function AdvancedCvRoutes() {
  return <Routes><Route path="advanced-cv" element={<CvLanding />} /><Route path="advanced-cv/new" element={<CvNew />} /><Route path="advanced-cv/:projectId" element={<CvEditor />} /></Routes>;
}

