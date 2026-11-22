import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { User, Lock, Settings, ChevronRight, Save, LogOut, Mail, Phone, MapPin, Linkedin, Github, Globe, Shield, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { useSession } from '../auth/AuthProvider';
import { useWorkspace } from '../dashboard/data';
import { QueryState } from '../dashboard/QueryState';
import type { CareerProfileData } from '../cv/careerProfile';
import { CareerProfileEditor } from './CareerProfileEditor';
import './profile.css';

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const user = session.data?.user;
  const [activeTab, setActiveTab] = useState<'personal' | 'career' | 'security' | 'preferences'>('personal');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoutPending, setLogoutPending] = useState(false);

  // Personal information state
  const [personal, setPersonal] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: '',
    location: '',
    professionalTitle: '',
    bio: '',
    linkedin: '',
    github: '',
    portfolio: '',
  });

  // Security state
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Preferences state
  const [preferences, setPreferences] = useState({
    theme: 'light',
    cvPageSize: 'A4',
    region: 'US',
    dateFormat: 'MM/DD/YYYY',
    editorFontSize: 14,
    notifications: true,
  });

  const profile = useWorkspace<CareerProfileData>('career-profile', '/career-profile/');

  // Personal details are stored in the shared Career Profile, so hydrate the form from it.
  useEffect(() => {
    const p = profile.data?.personal;
    if (!p) return;
    setPersonal({
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      email: p.email ?? '',
      phone: p.phone ?? '',
      location: p.location ?? '',
      professionalTitle: p.professional_title ?? '',
      bio: p.bio ?? '',
      linkedin: p.linkedin ?? '',
      github: p.github ?? '',
      portfolio: p.portfolio ?? '',
    });
  }, [profile.data?.revision, profile.data?.personal?.first_name, profile.data?.personal?.last_name]);

  async function savePersonal() {
    setPending(true);
    setError('');
    setSuccess('');
    try {
      await api('/career-profile/', {
        method: 'PUT',
        body: JSON.stringify({
          personal: {
            first_name: personal.firstName,
            last_name: personal.lastName,
            phone: personal.phone,
            location: personal.location,
            professional_title: personal.professionalTitle,
            bio: personal.bio,
            linkedin: personal.linkedin,
            github: personal.github,
            portfolio: personal.portfolio,
          },
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      setSuccess('Personal information saved to your Career Profile.');
      window.setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function changePassword() {
    if (security.newPassword !== security.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setPending(true);
    setError('');
    setSuccess('');
    try {
      await api('/auth/profile/change-password/', {
        method: 'POST',
        body: JSON.stringify({
          current_password: security.currentPassword,
          new_password: security.newPassword,
        }),
      });
      setSuccess('Password changed successfully.');
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
      window.setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function savePreferences() {
    setPending(true);
    setError('');
    setSuccess('');
    try {
      await api('/auth/preferences/', {
        method: 'PATCH',
        body: JSON.stringify(preferences),
      });
      setSuccess('Preferences saved successfully.');
      window.setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    setLogoutPending(true);
    setError('');
    try {
      await api('/auth/logout/', { method: 'POST' });
      queryClient.clear();
      queryClient.setQueryData(['session'], { user: null });
      navigate('/login', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setLogoutPending(false);
    }
  }

  const tabs = [
    { id: 'personal', label: 'Personal Information', icon: User },
    { id: 'career', label: 'Career Profile Vault', icon: Settings },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'preferences', label: 'Preferences', icon: Settings },
  ] as const;

  return (
    <div className="profile-page">
      <div className="dash-page-header">
        <div>
          <span className="eyebrow">USER PROFILE</span>
          <h1>Profile Settings</h1>
          <p className="dash-subtitle">Manage your personal information, career profile, security settings, and application preferences.</p>
        </div>
      </div>

      {error && <p className="dash-error" role="alert">{error}</p>}
      {success && <p className="dash-success" role="status">{success}</p>}

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <nav className="profile-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`profile-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id as any)}
                >
                  <Icon size={18} />
                  {tab.label}
                  <ChevronRight size={16} className="tab-chevron" />
                </button>
              );
            })}
          </nav>

          <div className="profile-sidebar-footer">
            <button type="button" className="profile-logout-button" disabled={logoutPending} onClick={() => void handleLogout()}>
              <LogOut size={18} />
              {logoutPending ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </aside>

        <main className="profile-main">
          {activeTab === 'personal' && (
            <section className="profile-section">
              <h2>Personal Information</h2>
              <p className="dash-caption">Update your personal details and contact information.</p>

              <div className="profile-form">
                <div className="form-row">
                  <label>
                    First Name
                    <input value={personal.firstName} onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })} disabled={pending} />
                  </label>
                  <label>
                    Last Name
                    <input value={personal.lastName} onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })} disabled={pending} />
                  </label>
                </div>

                <label>
                  Email
                  <input type="email" value={personal.email} disabled />
                  <span className="field-hint">Email cannot be changed. Contact support if needed.</span>
                </label>

                <label>
                  Phone
                  <input value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} disabled={pending} />
                </label>

                <label>
                  Location
                  <input value={personal.location} onChange={(e) => setPersonal({ ...personal, location: e.target.value })} disabled={pending} />
                </label>

                <label>
                  Professional Title
                  <input value={personal.professionalTitle} onChange={(e) => setPersonal({ ...personal, professionalTitle: e.target.value })} disabled={pending} />
                </label>

                <label>
                  Bio
                  <textarea rows={4} value={personal.bio} onChange={(e) => setPersonal({ ...personal, bio: e.target.value })} disabled={pending} />
                </label>

                <label>
                  LinkedIn
                  <input value={personal.linkedin} onChange={(e) => setPersonal({ ...personal, linkedin: e.target.value })} disabled={pending} />
                </label>

                <label>
                  GitHub
                  <input value={personal.github} onChange={(e) => setPersonal({ ...personal, github: e.target.value })} disabled={pending} />
                </label>

                <label>
                  Portfolio
                  <input value={personal.portfolio} onChange={(e) => setPersonal({ ...personal, portfolio: e.target.value })} disabled={pending} />
                </label>

                <div className="form-actions">
                  <button type="button" className="button button-primary" disabled={pending} onClick={() => void savePersonal()}>
                    <Save size={16} />
                    {pending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'career' && (
            <section className="profile-section">
              <h2>Career Profile Vault</h2>
              <p className="dash-caption">Manage your career information that can be imported into CVs and cover letters.</p>
              
              <QueryState pending={profile.isPending} error={profile.error} retry={profile.refetch}>
                <div className="career-profile-summary">
                  <div className="career-stat">
                    <span className="career-stat-label">Profile Completion</span>
                    <span className="career-stat-value">{profile.data?.percent || 0}%</span>
                  </div>
                  <p className="dash-caption">
                    Enter your professional information once here. Use <strong>Import from Career Profile</strong> in the CV Builder or Cover Letter Builder to reuse it.
                  </p>
                </div>

                <p className="dash-info">
                  <Shield size={16} />
                  Importing creates an editable copy inside the document, so editing a CV or cover letter never changes this profile, and changing this profile
                  never overwrites an existing document until you choose to refresh it.
                </p>

                {profile.data && <CareerProfileEditor profile={profile.data} />}
              </QueryState>
            </section>
          )}

          {activeTab === 'security' && (
            <section className="profile-section">
              <h2>Security Settings</h2>
              <p className="dash-caption">Change your password and manage account security.</p>

              <div className="profile-form">
                <label>
                  Current Password
                  <input type="password" value={security.currentPassword} onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })} disabled={pending} />
                </label>

                <label>
                  New Password
                  <input type="password" value={security.newPassword} onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })} disabled={pending} />
                </label>

                <label>
                  Confirm New Password
                  <input type="password" value={security.confirmPassword} onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })} disabled={pending} />
                </label>

                <div className="form-actions">
                  <button type="button" className="button button-primary" disabled={pending} onClick={() => void changePassword()}>
                    <Lock size={16} />
                    {pending ? 'Changing...' : 'Change Password'}
                  </button>
                </div>

                <div className="security-notice">
                  <AlertTriangle size={16} />
                  <p>
                    Two-factor authentication is not yet implemented. Your account is protected by your password.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'preferences' && (
            <section className="profile-section">
              <h2>Preferences</h2>
              <p className="dash-caption">Customize your application experience and default document settings.</p>

              <div className="profile-form">
                <label>
                  Theme
                  <select value={preferences.theme} onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })} disabled={pending}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>

                <label>
                  Default CV Page Size
                  <select value={preferences.cvPageSize} onChange={(e) => setPreferences({ ...preferences, cvPageSize: e.target.value })} disabled={pending}>
                    <option value="A4">A4</option>
                    <option value="Letter">US Letter</option>
                  </select>
                </label>

                <label>
                  Region
                  <select value={preferences.region} onChange={(e) => setPreferences({ ...preferences, region: e.target.value })} disabled={pending}>
                    <option value="US">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="EU">Europe</option>
                  </select>
                </label>

                <label>
                  Date Format
                  <select value={preferences.dateFormat} onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })} disabled={pending}>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </label>

                <label>
                  Editor Font Size
                  <input type="number" value={preferences.editorFontSize} onChange={(e) => setPreferences({ ...preferences, editorFontSize: parseInt(e.target.value) || 14 })} disabled={pending} min={10} max={20} />
                </label>

                <label className="checkbox-label">
                  <input type="checkbox" checked={preferences.notifications} onChange={(e) => setPreferences({ ...preferences, notifications: e.target.checked })} disabled={pending} />
                  Enable email notifications
                </label>

                <div className="form-actions">
                  <button type="button" className="button button-primary" disabled={pending} onClick={() => void savePreferences()}>
                    <Save size={16} />
                    {pending ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
