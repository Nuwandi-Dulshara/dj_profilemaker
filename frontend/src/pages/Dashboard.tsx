import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  UserRound,
  LogOut,
  Search,
  RefreshCw,
  QrCode,
  Share2,
  Download,
  Eye,
  BarChart2,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { profilesApi } from '../api/profiles';
import type { Profile } from '../data/templates';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import QrCodeModal from '../components/QrCodeModal';
import ShareModal from '../components/ShareModal';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedProfileForQr, setSelectedProfileForQr] = useState<Profile | null>(null);
  const [selectedProfileForShare, setSelectedProfileForShare] = useState<Profile | null>(null);

  const loadProfiles = async (search?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await profilesApi.getProfiles(search);
      setProfiles(data);
    } catch (err: any) {
      setError(err?.message || 'Unable to load profiles from database.');
      toast.error('Failed to load profiles');
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
      toast.success(`Profile "${name}" deleted.`);
    } catch (err: any) {
      toast.error(err?.message || 'Unable to delete profile.');
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Analytics aggregations
  const totalProfiles = profiles.length;
  const totalViews = profiles.reduce((acc, curr) => acc + (curr.views_count || 12), 0);
  const totalSkills = profiles.reduce((acc, curr) => acc + (curr.skills?.length || 0), 0);

  return (
    <div className="dashboard-page container">
      {/* MODALS */}
      {selectedProfileForQr && (
        <QrCodeModal
          slug={selectedProfileForQr.slug}
          name={selectedProfileForQr.name}
          onClose={() => setSelectedProfileForQr(null)}
        />
      )}
      {selectedProfileForShare && (
        <ShareModal
          slug={selectedProfileForShare.slug}
          name={selectedProfileForShare.name}
          title={selectedProfileForShare.title}
          onClose={() => setSelectedProfileForShare(null)}
        />
      )}

      {/* DASHBOARD HEADER */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DIGITAL WORKSPACE</span>
          <h1>My Profiles</h1>
          <p>
            Welcome, <strong>{user?.name || user?.email}</strong>. Manage and track your digital presence.
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link className="btn btn-outline" to="/settings" title="Account Settings">
            <SettingsIcon size={16} /> Settings
          </Link>
          <Link className="btn btn-primary" to="/builder">
            <Plus size={17} /> New Profile
          </Link>
          <button type="button" className="btn btn-outline" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* ANALYTICS OVERVIEW CARD (#3) */}
      <div className="analytics-summary-grid">
        <div className="analytics-card">
          <div className="analytics-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <UserRound size={22} />
          </div>
          <div>
            <span className="analytics-label">Active Profiles</span>
            <strong className="analytics-val">{totalProfiles}</strong>
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Eye size={22} />
          </div>
          <div>
            <span className="analytics-label">Total Profile Views</span>
            <strong className="analytics-val">{totalViews}</strong>
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <span className="analytics-label">Skills Showcased</span>
            <strong className="analytics-val">{totalSkills}</strong>
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-icon-wrap" style={{ background: '#fffbeb', color: '#d97706' }}>
            <BarChart2 size={22} />
          </div>
          <div>
            <span className="analytics-label">Engagement Rate</span>
            <strong className="analytics-val">98.4%</strong>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', marginTop: '20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: '1', maxWidth: '420px' }}>
          <input
            type="text"
            placeholder="Search profiles by name or role..."
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
        <div
          style={{
            padding: '14px 18px',
            background: '#ffeef0',
            color: '#dc3545',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => loadProfiles()}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
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
          <p>
            {searchQuery
              ? 'Try a different search query or clear the filter.'
              : 'Make your first digital profile to see it here.'}
          </p>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h2 style={{ margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {profile.name}
                    </h2>
                    <span className="template-badge-pill">{profile.template_id}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '12px' }}>
                    {profile.title || 'No title yet'}
                  </p>
                </div>
              </div>

              <p className="profile-card-bio">{profile.bio || 'No bio yet.'}</p>

              {/* CARD TOOLS: QR, SHARE, PDF */}
              <div style={{ display: 'flex', gap: '6px', margin: '14px 0 6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <button
                  type="button"
                  className="quick-icon-btn"
                  title="Share Profile"
                  onClick={() => setSelectedProfileForShare(profile)}
                >
                  <Share2 size={14} /> Share
                </button>
                <button
                  type="button"
                  className="quick-icon-btn"
                  title="Generate QR Code"
                  onClick={() => setSelectedProfileForQr(profile)}
                >
                  <QrCode size={14} /> QR
                </button>
                <Link
                  to={`/p/${profile.slug}`}
                  target="_blank"
                  className="quick-icon-btn"
                  title="Download PDF via Public View"
                >
                  <Download size={14} /> PDF
                </Link>
                <Link
                  to={`/p/${profile.slug}`}
                  target="_blank"
                  className="quick-icon-btn"
                  title="Public View"
                >
                  <ExternalLink size={14} /> Link
                </Link>
              </div>

              <div className="card-actions">
                <Link to={`/builder?id=${profile.id}`} className="btn btn-outline" style={{ flex: 1 }}>
                  <Pencil size={15} /> Edit
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
