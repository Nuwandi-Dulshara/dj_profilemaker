import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Eye, LayoutTemplate, ArrowLeft } from 'lucide-react';
import ProfileForm from '../components/ProfileForm';
import ProfilePreview from '../components/ProfilePreview';
import { emptyProfile, templates } from '../data/templates';
import type { Profile } from '../data/templates';
import { profilesApi } from '../api/profiles';

export default function Builder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('id');

  const [profile, setProfile] = useState<Profile>(() => ({ ...emptyProfile }));
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!editingId) {
        setProfile({ ...emptyProfile });
        return;
      }
      setIsLoading(true);
      setErrorMessage('');
      try {
        const data = await profilesApi.getProfile(editingId);
        setProfile(data);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Unable to load profile.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
    setMessage('');
  }, [editingId]);

  const saveProfile = async () => {
    if (!profile.name.trim()) {
      alert('Please enter your name.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      let saved: Profile;
      if (profile.id) {
        saved = await profilesApi.updateProfile(profile.id, profile);
      } else {
        saved = await profilesApi.createProfile(profile);
      }
      setProfile(saved);
      setMessage('Profile saved successfully to database!');
      if (!profile.id && saved.id) {
        navigate(`/builder?id=${saved.id}`, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save profile. Please check all fields.');
    } finally {
      setIsSaving(false);
    }
  };

  const viewPublicProfile = () => {
    if (!profile.id || !profile.slug) {
      alert('Save your profile first to view its public page.');
      return;
    }
    window.open(`/p/${profile.slug}`, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="builder-page container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p style={{ color: '#77839a' }}>Loading profile from database...</p>
      </div>
    );
  }

  return (
    <div className="builder-page container">
      <div className="page-heading">
        <div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/dashboard')}
            style={{ marginBottom: '10px', padding: '6px 12px', fontSize: '12px' }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <span className="eyebrow" style={{ display: 'block' }}>
            PROFILE EDITOR
          </span>
          <h1>Create Your Digital Profile</h1>
          <p>Design your profile and watch it come to life.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline" onClick={viewPublicProfile}>
            <Eye size={17} /> View Profile
          </button>
          <button type="button" className="btn btn-primary" onClick={saveProfile} disabled={isSaving}>
            <Save size={17} /> {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {message && (
        <div role="status" className="success-message">
          {message}
        </div>
      )}

      {errorMessage && (
        <div style={{ padding: '12px 18px', background: '#ffeef0', color: '#dc3545', borderRadius: '10px', marginBottom: '20px', fontSize: '13px' }}>
          {errorMessage}
        </div>
      )}

      <div className="builder-layout">
        <div className="editor-panel">
          <ProfileForm profile={profile} setProfile={setProfile} />
        </div>
        <div className="preview-panel">
          <div className="template-panel">
            <h2>
              <LayoutTemplate size={19} /> Choose Template
            </h2>
            <div className="template-options">
              {templates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={`template-option ${profile.template_id === template.id ? 'selected' : ''}`}
                  onClick={() => setProfile((prev) => ({ ...prev, template_id: template.id }))}
                  title={template.description}
                >
                  <span className={`template-swatch swatch-${template.id}`} />
                  {template.name}
                </button>
              ))}
            </div>
          </div>
          <div className="preview-label">
            <span>LIVE PREVIEW</span>
            <span className="live-indicator">
              <span /> Live
            </span>
          </div>
          <ProfilePreview profile={profile} />
        </div>
      </div>
    </div>
  );
}
