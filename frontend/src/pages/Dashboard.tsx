import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, UserRound } from 'lucide-react';
import { readProfiles, writeProfiles } from '../utils/storage';
export default function Dashboard() {
  const [profiles, setProfiles] = useState(readProfiles);
  const deleteProfile = (id: string) => {
    if (!window.confirm('Delete this profile?')) return;
    const updated = profiles.filter(item => item.id !== id);
    try {writeProfiles(updated); setProfiles(updated);} catch {alert('Unable to delete profile from browser storage.');}
  };
  return <div className="dashboard-page"><div className="page-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>My Profiles</h1><p>Create and manage your digital profiles.</p></div><Link className="btn btn-primary" to="/builder"><Plus size={17}/> New Profile</Link></div>
    {profiles.length === 0 ? <div className="empty-state"><UserRound size={46}/><h2>No profiles yet</h2><p>Make your first digital profile to see it here.</p><Link to="/builder" className="btn btn-primary"><Plus size={16}/> Create Profile</Link></div> : <div className="profile-grid">{profiles.map(profile => <article className="profile-card" key={profile.id}><div className="profile-card-top">{profile.photo ? <img className="small-avatar" src={profile.photo} alt=""/> : <div className="small-avatar placeholder"><UserRound/></div>}<div><h2>{profile.name}</h2><p>{profile.title || 'No title yet'}</p></div></div><p className="profile-card-bio">{profile.bio || 'No bio yet.'}</p><div className="card-actions"><Link to={`/builder?id=${profile.id}`} className="btn btn-outline"><Pencil size={15}/> Edit</Link><Link to={`/p/${profile.slug}`} className="btn btn-outline"><ExternalLink size={15}/> View</Link><button type="button" className="icon-button danger" onClick={() => profile.id && deleteProfile(profile.id)} aria-label={`Delete ${profile.name}`}><Trash2 size={17}/></button></div></article>)}</div>}
  </div>;
}
