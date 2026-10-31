import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, UserRound, LogOut, Search, RefreshCw } from 'lucide-react';
import { profilesApi } from '../api/profiles';
import type { Profile } from '../data/templates';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadProfiles = async (search?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await profilesApi.getProfiles(search);
      setProfiles(data);
    } catch (err: any) {
      setError(err?.message || 'Unable to load profiles from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProfiles(searchQuery);
  };

  const deleteProfile = async (id: string, name: string) => {
    if (!window.confirm(`Delete profile "${name}" permanently?`)) return;
    try {
      await profilesApi.deleteProfile(id);
      setProfiles((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      alert(err?.message || 'Unable to delete profile.');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-page container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>My Profiles</h1>
          <p>
            Welcome, <strong>{user?.name || user?.email}</strong>. Manage your digital profiles.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-primary" to="/builder">
            <Plus size={17} /> New Profile
          </Link>
          <button type="button" className="btn btn-outline" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: '1', maxWidth: '420px' }}>
          <input
            type="text"
            placeholder="Search profiles by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #dfe5ef',
              background: '#fff',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <button type="submit" className="btn btn-outline" style={{ padding: '9px 14px' }}>
            <Search size={15} /> Search
          </button>
        </form>
        {searchQuery && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setSearchQuery('');
              loadProfiles('');
            }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '14px 18px', background: '#ffeef0', color: '#dc3545', borderRadius: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-outline" onClick={() => loadProfiles()} style={{ padding: '6px 12px', fontSize: '12px' }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p style={{ color: '#77839a' }}>Loading profiles from database...</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <UserRound size={46} />
          <h2>{searchQuery ? 'No matching profiles found' : 'No profiles yet'}</h2>
          <p>{searchQuery ? 'Try a different search query or clear the filter.' : 'Make your first digital profile to see it here.'}</p>
          <Link to="/builder" className="btn btn-primary">
            <Plus size={16} /> Create Profile
          </Link>
        </div>
      ) : (
        <div className="profile-grid">
          {profiles.map((profile) => (
            <article className="profile-card" key={profile.id}>
              <div className="profile-card-top">
                {profile.photo ? (
                  <img className="small-avatar" src={profile.photo} alt={profile.name} />
                ) : (
                  <div className="small-avatar placeholder">
                    <UserRound />
                  </div>
                )}
                <div>
                  <h2>{profile.name}</h2>
                  <p>{profile.title || 'No title yet'}</p>
                </div>
              </div>
              <p className="profile-card-bio">{profile.bio || 'No bio yet.'}</p>
              <div className="card-actions">
                <Link to={`/builder?id=${profile.id}`} className="btn btn-outline">
                  <Pencil size={15} /> Edit
                </Link>
                <Link to={`/p/${profile.slug}`} className="btn btn-outline" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} /> View
                </Link>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => profile.id && deleteProfile(profile.id, profile.name)}
                  aria-label={`Delete ${profile.name}`}
                  title="Delete profile"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
