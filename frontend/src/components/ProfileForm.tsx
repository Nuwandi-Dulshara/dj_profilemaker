import { useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import type { Profile } from '../data/templates';
interface Props { profile: Profile; setProfile: Dispatch<SetStateAction<Profile>> }
type TextField = 'name' | 'title' | 'email' | 'phone' | 'location' | 'bio' | 'photo';
export default function ProfileForm({profile, setProfile}: Props) {
  const [skillName, setSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState(80);
  const [platform, setPlatform] = useState('GitHub');
  const [linkUrl, setLinkUrl] = useState('');
  const updateField = (field: TextField, value: string) => setProfile(prev => ({...prev, [field]: value}));
  const addSkill = () => {
    if (!skillName.trim()) return;
    setProfile(prev => ({...prev, skills: [...prev.skills, {id: crypto.randomUUID(), name: skillName.trim(), level: skillLevel}]}));
    setSkillName(''); setSkillLevel(80);
  };
  const removeSkill = (id: string) => setProfile(prev => ({...prev, skills: prev.skills.filter(skill => skill.id !== id)}));
  const updateSkill = (id: string, level: number) => setProfile(prev => ({...prev, skills: prev.skills.map(skill => skill.id === id ? {...skill, level} : skill)}));
  const addLink = () => {
    let url: URL;
    try { url = new URL(linkUrl.trim()); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol'); }
    catch { alert('Please enter a valid HTTP or HTTPS URL.'); return; }
    setProfile(prev => ({...prev, links: [...prev.links, {id: crypto.randomUUID(), platform, url: url.href}]}));
    setLinkUrl('');
  };
  const removeLink = (id: string) => setProfile(prev => ({...prev, links: prev.links.filter(link => link.id !== id)}));
  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {alert('Please select a JPG, PNG, or WebP image.'); return;}
    if (file.size > 1024 * 1024) {alert('Please use an image smaller than 1 MB for this demo.'); return;}
    const reader = new FileReader();
    reader.onload = () => {if (typeof reader.result === 'string') updateField('photo', reader.result);};
    reader.readAsDataURL(file);
  };
  const fields: {label: string; name: Exclude<TextField,'bio'|'photo'>; placeholder: string; type?: string}[] = [
    {label:'Full Name', name:'name', placeholder:'Alex Morgan'},
    {label:'Professional Title', name:'title', placeholder:'Full Stack Developer'},
    {label:'Email', name:'email', placeholder:'alex@example.com', type:'email'},
    {label:'Phone', name:'phone', placeholder:'+94 77 123 4567'},
    {label:'Location', name:'location', placeholder:'Colombo, Sri Lanka'},
  ];
  return <div className="editor-form">
    <div className="panel-heading"><h2>Personal Information</h2><p>Introduce yourself to your visitors.</p></div>
    <div className="form-section">
      {fields.map(field => <label className="field" key={field.name}><span>{field.label}</span><input type={field.type ?? 'text'} value={profile[field.name]} placeholder={field.placeholder} onChange={e => updateField(field.name,e.target.value)}/></label>)}
      <label className="field"><span>Biography</span><textarea rows={5} placeholder="Tell us about yourself..." value={profile.bio} onChange={e => updateField('bio',e.target.value)}/></label>
      <label className="field"><span>Profile Photo</span><span className="upload-box"><Upload size={20}/><span>Choose profile photo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhoto} hidden/></span></label>
    </div>
    <div className="panel-heading section-spacing"><h2>Skills</h2><p>Add your technical and professional skills.</p></div>
    <div className="form-section"><div className="input-row">
      <input aria-label="Skill name" placeholder="Skill name, e.g. React" value={skillName} onChange={e => setSkillName(e.target.value)}/>
      <input aria-label="Skill level" className="level-input" type="number" min={0} max={100} value={skillLevel} onChange={e => setSkillLevel(Math.max(0,Math.min(100,Number(e.target.value))))}/>
      <button type="button" className="btn btn-primary" onClick={addSkill} aria-label="Add skill"><Plus size={17}/></button>
    </div>
    {profile.skills.map(skill => <div className="skill-editor" key={skill.id}><div className="skill-row"><strong>{skill.name}</strong><span>{skill.level}%</span><button type="button" className="icon-button" onClick={() => removeSkill(skill.id)} aria-label={`Remove ${skill.name}`}><Trash2 size={16}/></button></div><input aria-label={`${skill.name} proficiency`} type="range" min={0} max={100} value={skill.level} onChange={e => updateSkill(skill.id,Number(e.target.value))}/></div>)}
    </div>
    <div className="panel-heading section-spacing"><h2>Social Links</h2><p>Add websites visitors can use to reach you.</p></div>
    <div className="form-section"><label className="field"><span>Platform</span><select value={platform} onChange={e => setPlatform(e.target.value)}><option>GitHub</option><option>LinkedIn</option><option>Portfolio</option><option>Instagram</option><option>Other</option></select></label>
      <label className="field"><span>Profile URL</span><input type="url" placeholder="https://example.com" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}/></label>
      <button type="button" className="btn btn-outline full-width" onClick={addLink}><Plus size={16}/> Add Link</button>
      {profile.links.map(link => <div className="saved-link" key={link.id}><div><strong>{link.platform}</strong><small>{link.url}</small></div><button type="button" className="icon-button" onClick={() => removeLink(link.id)} aria-label={`Remove ${link.platform}`}><Trash2 size={16}/></button></div>)}
    </div>
  </div>;
}
