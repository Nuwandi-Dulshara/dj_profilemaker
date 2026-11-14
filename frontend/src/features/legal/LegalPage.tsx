import { Link } from 'react-router-dom';
import './legal.css';

const policies = {
  terms: {
    title: 'Terms of Service',
    intro: 'A simple agreement for trying Advanced CV & Cover Letter Studio on your development machine.',
    sections: [
      ['Purpose and scope', 'This installation is an unfinished development environment for testing account registration, sign-in and related Studio features. These terms apply only to this local installation, not to a public service.'],
      ['Test accounts and responsible use', 'Use fictional profile details and a password you do not use elsewhere. Do not submit confidential documents, real applicant information or another person’s personal data. Use only material you are authorized to use and do not misuse accounts or attempt unauthorized access.'],
      ['Availability and test data', 'Features may be incomplete or change without notice. The developer may reset accounts and test data while debugging or rebuilding the database. Do not rely on this installation for storing important work; keep your own copies.'],
      ['Your content', 'You retain your rights in material you provide. Submitting test content permits this installation to process it for the functionality you are testing. No career outcome, document export or other unfinished feature is promised.'],
      ['Agreement and changes', 'Registration records your acceptance of these terms and the accompanying privacy notice, including a policy version and timestamp. Version local-dev-2026-11-15 describes this local testing setup. Before any public launch, replace these development policies with policies appropriate to the actual operator and deployment.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'How the current development installation handles account information while you test it.',
    sections: [
      ['Information stored', 'Registration stores your first name, last name, email address, a password hash, and the accepted policy version and timestamp in the configured PostgreSQL database. Authentication also stores session information and sign-in metadata. Passwords are hashed rather than stored as plain text.'],
      ['Why it is used', 'This information supports account creation, sign-in, sign-out, password reset and recording policy acceptance. Abuse prevention stores keyed hashes derived from request IP addresses with counters and expiry times. Development server logs may contain request paths and technical errors.'],
      ['Cookies', 'The application uses a session cookie to keep you signed in and a CSRF cookie to help protect form submissions. Remember Me changes session persistence. Signing out invalidates the server session. The current authentication code does not store passwords or authentication tokens in browser localStorage.'],
      ['Storage and password-reset messages', 'Data is stored wherever the developer configures PostgreSQL; running the website locally does not guarantee that its database is local. The default development email backend prints password-reset links to the backend console. Browser tests use email files instead. Anyone with access to those outputs may see reset links. If SMTP is configured, reset messages are handled by that configured email service.'],
      ['Retention and removal', 'There is no automatic account-erasure or retention schedule implemented for this development setup. Test data can remain until the developer removes it or resets the dedicated database. To remove your test account, ask the person running this installation; on your own machine, you control that setup. Logs, email output and backups require separate cleanup.'],
      ['Local testing scope', 'Use fictional data only. This notice describes the current authentication implementation, not planned document, AI or sharing features. Revisit it whenever data handling changes and before opening the service to the public. Policy version: local-dev-2026-11-15.'],
    ],
  },
};

export function LegalPage({ kind }: { kind: keyof typeof policies }) {
  const policy = policies[kind];
  return <main className="legal-page">
    <div className="legal-shell">
      <Link className="legal-brand" to="/">Advanced CV &amp; Cover Letter Studio</Link>
      <article className="legal-card">
        <header>
          <span className="eyebrow">Local development only</span>
          <h1>{policy.title}</h1>
          <p className="legal-intro">{policy.intro}</p>
          <p className="legal-version">Updated 15 November 2026 · Version local-dev-2026-11-15</p>
        </header>
        <aside className="legal-notice">For this local test installation. These are development policies, not policies for a public service.</aside>
        {policy.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
        <nav className="legal-actions" aria-label="Policy navigation">
          <Link className="button button-primary" to="/register">Back to registration</Link>
          <Link className="legal-other" to={kind === 'terms' ? '/privacy' : '/terms'}>{kind === 'terms' ? 'Privacy Policy' : 'Terms of Service'}</Link>
        </nav>
      </article>
    </div>
  </main>;
}
