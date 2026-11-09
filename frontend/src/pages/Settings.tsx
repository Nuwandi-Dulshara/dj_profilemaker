import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Moon,
  Sun,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [emailVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleProfileUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Full name is required.');
      return;
    }
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Account profile updated successfully!');
    }, 500);
  };

  const handlePasswordUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Enter current password');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Password updated successfully!');
    }, 600);
  };

  const handleResendVerification = () => {
    toast.success(`Verification link sent to ${email || user?.email}!`);
  };

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: '850px' }}>
      <div style={{ marginBottom: '28px' }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('/dashboard')}
          style={{ marginBottom: '16px', padding: '6px 14px', fontSize: '13px' }}
        >
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
        <span className="eyebrow">PREFERENCES & SECURITY</span>
        <h1 style={{ fontSize: '28px', marginTop: '4px' }}>Account Settings</h1>
        <p style={{ color: '#64748b' }}>Manage your profile credentials, theme, and API integrations.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {/* EMAIL VERIFICATION STATUS CARD (#7) */}
        <div className="settings-card" style={{ padding: '20px 24px', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: emailVerified ? '#ecfdf5' : '#fffbeb',
                  color: emailVerified ? '#10b981' : '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {emailVerified ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '15px' }}>
                  Email Verification: {emailVerified ? 'Verified' : 'Pending Verification'}
                </strong>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {emailVerified
                    ? 'Your email address is authenticated and protected.'
                    : `Please verify your email address (${user?.email}) to protect your account.`}
                </span>
              </div>
            </div>
            {!emailVerified && (
              <button type="button" className="btn btn-outline" onClick={handleResendVerification}>
                <Mail size={15} /> Resend Verification
              </button>
            )}
          </div>
        </div>

        {/* THEME PREFERENCES (#4) */}
        <div className="settings-card" style={{ padding: '24px', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '6px' }}>Interface Appearance</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px' }}>
            Choose whether to display Profile Studio Pro in light or dark mode.
          </p>

          <div style={{ display: 'flex', gap: '14px' }}>
            <button
              type="button"
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTheme('light')}
              style={{ flex: 1, padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              <Sun size={18} /> Light Theme
            </button>
            <button
              type="button"
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTheme('dark')}
              style={{ flex: 1, padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              <Moon size={18} /> Dark Theme
            </button>
          </div>
        </div>

        {/* PROFILE INFO FORM */}
        <div className="settings-card" style={{ padding: '24px', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '6px' }}>Profile Information</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px' }}>
            Update your registered account name and email.
          </p>

          <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label className="field">
              <span>Full Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                required
              />
            </label>

            <label className="field">
              <span>Email Address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                required
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                <Save size={16} /> Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* PASSWORD CHANGE */}
        <div className="settings-card" style={{ padding: '24px', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '6px' }}>Security & Password</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px' }}>
            Ensure your account is using a strong password.
          </p>

          <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label className="field">
              <span>Current Password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label className="field">
                <span>New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </label>

              <label className="field">
                <span>Confirm New Password</span>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  minLength={8}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                <Lock size={16} /> Update Password
              </button>
            </div>
          </form>
        </div>


      </div>
    </div>
  );
}
