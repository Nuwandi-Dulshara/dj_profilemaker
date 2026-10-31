import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProfilePreview from '../components/ProfilePreview';
import { profilesApi } from '../api/profiles';
import type { Profile } from '../data/templates';

export default function PublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadPublicProfile() {
      if (!slug) return;
      setLoading(true);
      setError(false);
      try {
        const data = await profilesApi.getPublicProfile(slug);
        setProfile(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadPublicProfile();
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
      <div className="not-found container">
        <h1>Profile Not Found</h1>
        <p>The profile you are looking for does not exist or may have been deleted.</p>
        <Link className="btn btn-primary" to="/">
          Back Home
        </Link>
      </div>
    );
  }

  return (
    <div className="public-profile-page container">
      <ProfilePreview profile={profile} />
    </div>
  );
}
