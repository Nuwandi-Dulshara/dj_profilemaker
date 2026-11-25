import { FolderTree } from 'lucide-react';
import { Dialog } from '../../components/Dialog';

export interface StarterKit {
  id: string;
  name: string;
  description: string;
  defaultTitle: string;
  folders: string[];
  files: Record<string, string>;
}

const CV_STARTER_KITS: StarterKit[] = [
  {
    id: 'cv-modular',
    name: 'Modular React CV Starter',
    description: 'Clean folder skeleton (components/Header.jsx, components/Section.jsx, App.jsx, styles.css) ready for your own content.',
    defaultTitle: 'Modular CV Starter',
    folders: ['components'],
    files: {
      'App.jsx': `import React from "react";
import Header from "./components/Header.jsx";
import Section from "./components/Section.jsx";
import "./styles.css";

export default function App() {
  return (
    <main className="cv-page">
      <Header name="Your Name" title="Your Role" contact="email@example.com" />
      <Section title="SUMMARY">
        <p>Add your professional summary here.</p>
      </Section>
      <Section title="EXPERIENCE">
        <p>Add your experience entries here.</p>
      </Section>
    </main>
  );
}
`,
      'components/Header.jsx': `import React from "react";

export default function Header({ name, title, contact }) {
  return (
    <header className="cv-header">
      <h1>{name}</h1>
      <p>{title}</p>
      <p>{contact}</p>
    </header>
  );
}
`,
      'components/Section.jsx': `import React from "react";

export default function Section({ title, children }) {
  return (
    <section className="cv-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
`,
      'styles.css': `.cv-page { padding: 14mm 16mm; font-family: Arial, sans-serif; color: #0f172a; }
.cv-header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; }
.cv-header h1 { margin: 0; font-size: 20pt; }
.cv-section { margin-bottom: 12px; }
.cv-section h2 { font-size: 11pt; letter-spacing: 0.05em; border-bottom: 1px solid #cbd5e1; }
`,
    },
  },
  {
    id: 'cv-single',
    name: 'Single-File React CV Starter',
    description: 'Minimal App.jsx + styles.css starter structure with basic A4 styling.',
    defaultTitle: 'Single-File CV Starter',
    folders: [],
    files: {
      'App.jsx': `import React from "react";
import "./styles.css";

export default function App() {
  return (
    <article className="cv-page">
      <h1>Your Name</h1>
      <p>Your Role · email@example.com</p>
      <section>
        <h2>Summary</h2>
        <p>Write your summary here.</p>
      </section>
    </article>
  );
}
`,
      'styles.css': `.cv-page { padding: 14mm 16mm; font-family: Arial, sans-serif; color: #1e293b; }
`,
    },
  },
];

const COVER_LETTER_STARTER_KITS: StarterKit[] = [
  {
    id: 'cl-standard',
    name: 'Standard Cover Letter Starter',
    description: 'Clean letter.jsx + styles.css starter structure with header, salutation, body, and sign-off placeholders.',
    defaultTitle: 'Cover Letter Starter',
    folders: [],
    files: {
      'letter.jsx': `import React from "react";
import "./styles.css";

export default function CoverLetter() {
  return (
    <article className="cl-page">
      <header className="cl-header">
        <h1>Your Name</h1>
        <p>email@example.com</p>
      </header>
      <p>Dear [Hiring Manager],</p>
      <p>I am applying for the [Job Title] role at [Company Name].</p>
      <p>Sincerely,<br />Your Name</p>
    </article>
  );
}
`,
      'styles.css': `.cl-page { padding: 14mm 16mm; font-family: Georgia, serif; line-height: 1.55; color: #1e293b; }
.cl-header { border-bottom: 1px solid #0f172a; padding-bottom: 8px; margin-bottom: 16px; }
`,
    },
  },
];

export function StarterKitsDialog({
  kind,
  creating,
  onSelectKit,
  onClose,
}: {
  kind: 'advanced_cv' | 'cover_letter';
  creating: boolean;
  onSelectKit: (kit: StarterKit) => void;
  onClose: () => void;
}) {
  const kits = kind === 'cover_letter' ? COVER_LETTER_STARTER_KITS : CV_STARTER_KITS;

  return (
    <Dialog title="Project Starter Kits" onClose={() => !creating && onClose()}>
      <div className="dash-form adv-cv-versions">
        <p className="dash-dialog-lead">
          Choose a structural starter kit with pre-configured folders and files (without fake resume content), or close to create a blank project instead.
        </p>
        <div className="adv-cv-version-list" aria-label="Starter Kits">
          {kits.map((kit) => (
            <div key={kit.id} className="adv-cv-version-item">
              <div>
                <strong>
                  <FolderTree size={14} /> {kit.name}
                </strong>
                <span className="adv-cv-version-meta">{kit.description}</span>
              </div>
              <button
                type="button"
                className="button button-primary"
                disabled={creating}
                onClick={() => onSelectKit(kit)}
              >
                Use Starter Kit
              </button>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

