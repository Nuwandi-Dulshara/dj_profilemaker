import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layers3, ArrowLeft, Moon, Sun } from 'lucide-react';
import ProfilePreview from '../components/ProfilePreview';
import { profilesApi } from '../api/profiles';
import type { Profile } from '../data/templates';
import { useTheme } from '../context/ThemeContext';

export default function PublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    async function loadPublicProfile() {
      if (!slug) return;
      setLoading(true);
      setError(false);
      try {
        const data = await profilesApi.getPublicProfile(slug);
        setProfile(data);
        // Dynamic SEO document title
        if (data?.name) {
          document.title = `${data.name} | ${data.title || 'Digital Profile'} - Profile Studio Pro`;
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadPublicProfile();

    return () => {
      document.title = 'Profile Studio Pro | Digital Profile Builder';
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p style={{ color: '#77839a' }}>Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="not-found container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>Profile Not Found</h1>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>
          The profile you are looking for does not exist or may have been deleted.
        </p>
        <Link className="btn btn-primary" to="/">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="public-profile-page container">
      {/* MINIMAL TOP BAR */}
      <header className="public-topbar">
        <Link to="/" className="public-brand">
          <Layers3 size={18} />
          <span>Profile Studio <strong>Pro</strong></span>
        </Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={toggleTheme}
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link to="/" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <div style={{ marginTop: '20px' }}>
        <ProfilePreview profile={profile} isPublicView={true} />
      </div>
    </div>
  );
}
