import { FileText } from 'lucide-react';

/** Decorative sample, not an interactive editor or a saved user document. */
export function StudioIllustration() {
  return <figure className="studio-figure" aria-label="Sample CV layout with experience, education, and skills sections.">
    <div className="studio-preview-heading"><FileText size={20} aria-hidden="true" />Sample CV layout</div>
    <div className="studio-preview-page" aria-hidden="true">
      <span className="studio-preview-name" /><span className="studio-preview-contact" />
      {['Experience', 'Education', 'Skills'].map(section => <div className="studio-preview-section" key={section}><strong>{section}</strong><i /><i /><i /></div>)}
    </div>
  </figure>;
}
