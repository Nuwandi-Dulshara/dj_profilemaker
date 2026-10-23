import { Mail, Phone, MapPin, ExternalLink, UserRound } from 'lucide-react';
import type { Profile } from '../data/templates';
export default function ProfilePreview({profile}: {profile: Profile}) {
  return <article className={`profile-preview template-${profile.template_id}`}>
    <div className="preview-header"><div className="avatar">{profile.photo ? <img src={profile.photo} alt="Profile"/> : <UserRound size={44}/>}</div>
      <h1>{profile.name || 'Your Name'}</h1><p className="professional-title">{profile.title || 'Your Professional Title'}</p></div>
    <div className="preview-content"><section className="preview-section"><h3>About Me</h3><p className="bio-text">{profile.bio || 'Your professional biography will appear here as you type.'}</p></section>
      {profile.skills.length > 0 && <section className="preview-section"><h3>Skills & Expertise</h3><div className="preview-skills">{profile.skills.map(skill => <div key={skill.id} className="preview-skill"><div className="skill-row"><span>{skill.name}</span><span>{skill.level}%</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${skill.level}%`}}/></div></div>)}</div></section>}
      <section className="preview-section"><h3>Contact Information</h3><div className="contact-list">{profile.email && <p><Mail size={16}/><span>{profile.email}</span></p>}{profile.phone && <p><Phone size={16}/><span>{profile.phone}</span></p>}{profile.location && <p><MapPin size={16}/><span>{profile.location}</span></p>}{!profile.email && !profile.phone && !profile.location && <p>Your contact details will appear here.</p>}</div></section>
      {profile.links.length > 0 && <section className="preview-section"><h3>Find Me Online</h3><div className="social-links">{profile.links.map(link => <a href={link.url} key={link.id} target="_blank" rel="noopener noreferrer">{link.platform}<ExternalLink size={14}/></a>)}</div></section>}
    </div>
  </article>;
}
