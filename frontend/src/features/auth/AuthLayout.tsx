import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Files } from 'lucide-react';
import './auth.css';

export function AuthLayout({ children, register = false }: { children: ReactNode; register?: boolean }) {
  return <main className="auth-page"><Link className="auth-home" to="/"><ArrowLeft size={16} /> Back to Home</Link><div className="auth-card"><section className="auth-form-panel"><Link className="brand auth-brand" to="/"><span className="brand-mark"><Files size={22} /></span><span>Advanced CV<span className="brand-subtitle">& Cover Letter Studio</span></span></Link>{children}</section><aside className="auth-sea-panel"><svg className="coastline-divider" viewBox="0 0 100 1000" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 H28 C70 55 4 100 30 155 S85 235 42 300 S8 410 45 470 S78 565 32 630 S8 735 43 800 S70 900 25 1000 H0 Z" fill="white" /></svg><div className="sea-panel-copy"><h2>{register ? 'Your document workspace' : 'Manage your applications'}</h2><p>{register ? 'Keep your CVs and cover letters together, ready to edit for each role.' : 'Sign in to continue working on your CVs and cover letters.'}</p></div></aside></div></main>;
}
