import { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  UserRound,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Share2,
  QrCode,
  Download,
  MessageSquare,
  Sparkles,
  Eye,
} from 'lucide-react';

import type { Profile } from '../data/templates';
import QrCodeModal from './QrCodeModal';
import ShareModal from './ShareModal';
import ContactModal from './ContactModal';
import { exportProfileAsPdf } from '../utils/pdfExport';

interface Props {
  profile: Profile;
  isPublicView?: boolean;
}

export default function ProfilePreview({ profile, isPublicView = false }: Props) {
  const [showQr, setShowQr] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const containerId = `preview-card-${profile.slug || 'profile'}`;

  const handleDownloadPdf = () => {
    exportProfileAsPdf(containerId, `${profile.slug || 'resume'}-resume.pdf`);
  };

  return (
    <>
      {/* MODALS */}
      {showQr && (
        <QrCodeModal
          slug={profile.slug || 'demo'}
          name={profile.name || 'User'}
          onClose={() => setShowQr(false)}
        />
      )}
      {showShare && (
        <ShareModal
          slug={profile.slug || 'demo'}
          name={profile.name || 'User'}
          title={profile.title || 'Professional'}
          onClose={() => setShowShare(false)}
        />
      )}
      {showContact && (
        <ContactModal
          profileName={profile.name || 'User'}
          recipientEmail={profile.email || ''}
          onClose={() => setShowContact(false)}
        />
      )}

      {/* QUICK FLOATING ACTIONS BAR (FOR PUBLIC OR PREVIEW) */}
      <div className="preview-action-toolbar">
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setShowShare(true)}
          title="Share Profile"
        >
          <Share2 size={15} /> <span>Share</span>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setShowQr(true)}
          title="Show QR Code"
        >
          <QrCode size={15} /> <span>QR Code</span>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={handleDownloadPdf}
          title="Download PDF Resume"
        >
          <Download size={15} /> <span>PDF Resume</span>
        </button>
        {profile.email && (
          <button
            type="button"
            className="toolbar-btn primary-glow"
            onClick={() => setShowContact(true)}
            title="Send Message"
          >
            <MessageSquare size={15} /> <span>Contact</span>
          </button>
        )}
      </div>

      <article id={containerId} className={`profile-preview template-${profile.template_id}`}>
        {/* HEADER / AVATAR */}
        <div className="preview-header">
          <div className="avatar-wrapper">
            <div className="avatar">
              {profile.photo ? (
                <img src={profile.photo} alt={profile.name || 'Profile'} />
              ) : (
                <UserRound size={48} />
              )}
            </div>
            {profile.views_count !== undefined && profile.views_count > 0 && (
              <span className="views-badge" title="Total Profile Views">
                <Eye size={12} /> {profile.views_count} views
              </span>
            )}
          </div>

          <h1>{profile.name || 'Your Name'}</h1>
          <p className="professional-title">{profile.title || 'Your Professional Title'}</p>

          {/* CONTACT PILLS */}
          <div className="contact-quick-pills">
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="contact-pill"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Mail size={13} /> {profile.email}
              </a>
            )}
            {profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="contact-pill"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Phone size={13} /> {profile.phone}
              </a>
            )}
            {profile.location && (
              <span className="contact-pill">
                <MapPin size={13} /> {profile.location}
              </span>
            )}
          </div>
        </div>

        {/* MAIN BODY CONTENT */}
        <div className="preview-content">
          {/* ABOUT ME */}
          <section className="preview-section">
            <h3>About Me</h3>
            <p className="bio-text">
              {profile.bio || 'Your professional biography will appear here as you type.'}
            </p>
          </section>

          {/* WORK EXPERIENCE */}
          {profile.experiences && profile.experiences.length > 0 && (
            <section className="preview-section">
              <h3>
                <Briefcase size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Experience
              </h3>
              <div className="preview-timeline">
                {profile.experiences.map((exp) => (
                  <div key={exp.id} className="timeline-item">
                    <div className="timeline-header">
                      <strong>{exp.role}</strong>
                      <span className="timeline-date">{exp.startDate}</span>
                    </div>
                    <div className="timeline-company">{exp.company}</div>
                    {exp.description && <p className="timeline-desc">{exp.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* EDUCATION */}
          {profile.education && profile.education.length > 0 && (
            <section className="preview-section">
              <h3>
                <GraduationCap size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Education
              </h3>
              <div className="preview-timeline">
                {profile.education.map((edu) => (
                  <div key={edu.id} className="timeline-item">
                    <div className="timeline-header">
                      <strong>{edu.degree}</strong>
                      <span className="timeline-date">{edu.startDate}</span>
                    </div>
                    <div className="timeline-company">{edu.institution}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PROJECTS & PORTFOLIO */}
          {profile.projects && profile.projects.length > 0 && (
            <section className="preview-section">
              <h3>
                <FolderGit2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Featured Projects
              </h3>
              <div className="preview-projects-grid">
                {profile.projects.map((proj) => (
                  <div key={proj.id} className="preview-project-card">
                    <h4>{proj.title}</h4>
                    {proj.description && <p>{proj.description}</p>}
                    {proj.tags && <span className="project-tags">{proj.tags}</span>}
                    <div className="project-card-links">
                      {proj.demoUrl && (
                        <a href={proj.demoUrl} target="_blank" rel="noopener noreferrer">
                          Live Demo <ExternalLink size={12} />
                        </a>
                      )}
                      {proj.githubUrl && (
                        <a href={proj.githubUrl} target="_blank" rel="noopener noreferrer">
                          Code <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SKILLS */}
          {profile.skills.length > 0 && (
            <section className="preview-section">
              <h3>
                <Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Skills & Proficiency
              </h3>
              <div className="preview-skills">
                {profile.skills.map((skill) => (
                  <div key={skill.id} className="preview-skill">
                    <div className="skill-row">
                      <span>{skill.name}</span>
                      <span>{skill.level}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${skill.level}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SOCIAL LINKS */}
          {profile.links.length > 0 && (
            <section className="preview-section">
              <h3>Connect</h3>
              <div className="social-links">
                {profile.links.map((link) => (
                  <a href={link.url} key={link.id} target="_blank" rel="noopener noreferrer">
                    {link.platform} <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* CALL TO ACTION BUTTON ON PUBLIC PROFILE */}
          {isPublicView && profile.email && (
            <div className="preview-public-footer">
              <button
                type="button"
                className="btn btn-primary full-width"
                onClick={() => setShowContact(true)}
              >
                <MessageSquare size={16} /> Contact {profile.name}
              </button>
            </div>
          )}
        </div>
      </article>
    </>
  );
}
