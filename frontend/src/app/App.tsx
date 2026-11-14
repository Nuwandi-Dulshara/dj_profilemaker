import { Link, Route, Routes } from 'react-router-dom';
import { HomePage } from '../features/home/HomePage';
import { LegalPage } from '../features/legal/LegalPage';
import { AuthPage } from '../features/auth/AuthPages';
import { DashboardEntry, SessionBoundary } from '../features/auth/AuthProvider';

function NotFoundPage() {
  return <main className="route-message"><span className="eyebrow">ADVANCED CV & COVER LETTER STUDIO</span><h1>Page not found</h1><p>This address does not match a page in the studio.</p><Link className="button button-primary" to="/">Back to home</Link></main>;
}

export function App() {
  return <Routes><Route path="/terms" element={<LegalPage kind="terms" />} /><Route path="/privacy" element={<LegalPage kind="privacy" />} /><Route path="/" element={<HomePage />} /><Route element={<SessionBoundary guest />}><Route path="/login" element={<AuthPage key="login" mode="login" />} /><Route path="/register" element={<AuthPage key="register" mode="register" />} /></Route><Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot" />} /><Route path="/reset-password/:uid/:token" element={<AuthPage key="reset" mode="reset" />} /><Route element={<SessionBoundary />}><Route path="/dashboard/*" element={<DashboardEntry />} /></Route><Route path="*" element={<NotFoundPage />} /></Routes>;
}
