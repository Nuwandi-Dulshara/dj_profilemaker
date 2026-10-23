import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Eye, LayoutTemplate } from 'lucide-react';
import ProfileForm from '../components/ProfileForm';
import ProfilePreview from '../components/ProfilePreview';
import { emptyProfile, templates } from '../data/templates';
import type { Profile } from '../data/templates';
import { makeSlug, readProfiles, writeProfiles } from '../utils/storage';
export default function Builder() {
  const navigate = useNavigate(); const [searchParams] = useSearchParams(); const editingId = searchParams.get('id');
  const [profile, setProfile] = useState<Profile>(() => ({...emptyProfile}));
  const [message, setMessage] = useState('');
  useEffect(() => {
    const found = editingId ? readProfiles().find(item => item.id === editingId) : undefined;
    setProfile(found ?? {...emptyProfile}); setMessage('');
  }, [editingId]);
  const saveProfile = () => {
    if (!profile.name.trim()) {alert('Please enter your name.'); return;}
    const existing = readProfiles(); const id = profile.id ?? crypto.randomUUID();
    const previous = existing.find(item => item.id === id);
    const taken = new Set(existing.filter(item => item.id !== id).map(item => item.slug));
    const base = makeSlug(profile.name); let slug = previous?.slug || base;
    if (taken.has(slug)) {let suffix = 2; while (taken.has(`${base}-${suffix}`)) suffix++; slug = `${base}-${suffix}`;}
    const savedProfile: Profile = {...profile, id, slug};
    const updated = previous ? existing.map(item => item.id === id ? savedProfile : item) : [...existing, savedProfile];
    try {writeProfiles(updated); setProfile(savedProfile); setMessage('Profile saved successfully!'); navigate(`/builder?id=${id}`,{replace:true});}
    catch {alert('Unable to save. Browser storage may be full, especially if the photo is large.');}
  };
  const viewPublicProfile = () => {
    if (!profile.id || !profile.slug) {alert('Save your profile first.');return;}
    window.open(`/p/${profile.slug}`, '_blank', 'noopener,noreferrer');
  };
  return <div className="builder-page"><div className="page-heading"><div><span className="eyebrow">PROFILE EDITOR</span><h1>Create Your Digital Profile</h1><p>Design your profile and watch it come to life.</p></div><div className="page-actions"><button type="button" className="btn btn-outline" onClick={viewPublicProfile}><Eye size={17}/> View Profile</button><button type="button" className="btn btn-primary" onClick={saveProfile}><Save size={17}/> Save Profile</button></div></div>
    {message && <div role="status" className="success-message">{message}</div>}
    <div className="builder-layout"><div className="editor-panel"><ProfileForm profile={profile} setProfile={setProfile}/></div><div className="preview-panel"><div className="template-panel"><h2><LayoutTemplate size={19}/> Choose Template</h2><div className="template-options">{templates.map(template => <button type="button" key={template.id} className={`template-option ${profile.template_id === template.id ? 'selected' : ''}`} onClick={() => setProfile(prev => ({...prev, template_id: template.id}))} title={template.description}><span className={`template-swatch swatch-${template.id}`}/>{template.name}</button>)}</div></div><div className="preview-label"><span>LIVE PREVIEW</span><span className="live-indicator"><span/> Live</span></div><ProfilePreview profile={profile}/></div></div>
  </div>;
}
