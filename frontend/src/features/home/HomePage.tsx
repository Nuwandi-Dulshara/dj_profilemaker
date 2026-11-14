import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CodeXml, FileText, Files, LayoutTemplate, Menu, ScanText, ShieldCheck, Target, UserRound, X } from 'lucide-react';
import { StudioIllustration } from './StudioIllustration';

const navigation = [['Home', '#home'], ['Features', '#features'], ['How It Works', '#how-it-works'], ['About', '#about']];
const features = [
  { icon: CodeXml, title: 'Advanced CV Builder', description: 'Edit your CV content and layout, with a preview of your changes.' },
  { icon: LayoutTemplate, title: 'Professional CV Templates', description: 'Choose a layout that suits your experience and customize its fonts, spacing, and sections.' },
  { icon: FileText, title: 'Cover Letter Builder', description: 'Create professional, job-specific cover letters that match your CV.' },
  { icon: ShieldCheck, title: 'ATS Compatibility Checker', description: 'Identify potential formatting and parsing problems, with clear suggestions to improve your document.' },
  { icon: Target, title: 'Job Description Matching', description: 'Compare your CV with job requirements and identify relevant or missing skills.' },
  { icon: Files, title: 'Project Management', description: 'Organize CVs, cover letters, folders, versions, and saved projects in one workspace.' },
];
const steps = [
  ['Create an Account', 'Register and access your personal workspace.'],
  ['Choose a Tool', 'Select Advanced CV Builder, CV Templates, or Cover Letter Builder.'],
  ['Customize Your Document', 'Edit content, select designs, preview changes, and review suggestions.'],
  ['Save & Download', 'Save your projects and export supported document formats.'],
];

export function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  return (
    <div id="home" className="home-page">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header" onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuToggle.current?.focus(); }
      }}>
        <div className="container nav-row">
          <Link to="/" className="brand" aria-label="Advanced CV & Cover Letter Studio home">
            <span className="brand-mark"><Files size={23} aria-hidden="true" /></span>
            <span>Advanced CV<span className="brand-subtitle">& Cover Letter Studio</span></span>
          </Link>
          <nav aria-label="Main navigation" className="desktop-nav">
            {navigation.map(([label, href]) => <a href={href} key={label}>{label}</a>)}
          </nav>
          <div className="desktop-auth"><Link className="button button-outline button-small" to="/login">Login</Link><Link className="button button-primary button-small" to="/register">Register <ArrowRight size={15} /></Link></div>
          <button ref={menuToggle} className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="mobile-nav" hidden={!menuOpen}>
          {navigation.map(([label, href]) => <a href={href} key={label} onClick={() => setMenuOpen(false)}>{label}</a>)}
          <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link><Link to="/register" onClick={() => setMenuOpen(false)}>Register</Link>
        </nav>
      </header>

      <main id="main">
        <section className="hero container" aria-labelledby="hero-heading">
          <div className="hero-copy">
            
            <h1 id="hero-heading">Build Professional CVs & Cover Letters <span>with Confidence</span></h1>
            <p className="hero-description">Write and edit your CV and cover letters in one workspace. Choose a layout, tailor your content to a role, and keep your applications organized.</p>
            <div className="button-row"><Link to="/register" className="button button-primary">Get Started Free <ArrowRight size={18} /></Link><Link to="/login" className="button button-outline">Login</Link></div>
            <div className="hero-highlights"><span><Check />Free & Open-Source Tools</span><span><Check />ATS Compatibility Analysis</span><span><Check />Live Document Preview</span></div>
          </div>
          <StudioIllustration />
        </section>

        <div className="capability-strip"><div className="container"><div><CodeXml /> Create</div><div><LayoutTemplate /> Customize</div><div><ScanText /> Analyze</div><div><Files /> Organize</div></div></div>

        <section className="section container" id="features" aria-labelledby="features-heading">
          <div className="section-heading"><h2 id="features-heading">Everything You Need to Build<br className="desktop-break" /> Your Career Documents</h2><p>Tools for writing, reviewing, and organizing CVs and cover letters.</p></div>
          <div className="feature-grid">{features.map(({ icon: Icon, title, description }, i) => <article className="feature-card" key={title}><div className="feature-top"><span className="icon-tile"><Icon size={23} /></span><span className="feature-number">0{i + 1}</span></div><h3>{title}</h3><p>{description}</p></article>)}</div>
        </section>

        <section id="how-it-works" className="process-section" aria-labelledby="process-heading"><div className="container section"><div className="section-heading"><h2 id="process-heading">How It Works</h2><p>Create an account, choose a document, and start editing.</p></div><ol className="steps">{steps.map(([title, description], i) => <li key={title}><span className="step-number">0{i + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol></div></section>

        <section id="about" className="section container career-section" aria-labelledby="career-heading">
          <div className="career-diagram" role="img" aria-label="A master career profile supplies selected information to a tailored CV, a cover letter, and another career opportunity."><div className="profile-node"><span className="icon-tile"><UserRound /></span><div><strong>Master Career Profile</strong><span>Experience · Education · Skills</span></div><ShieldCheck size={19} /></div><div className="connector" /><div className="document-nodes">{['Targeted CV', 'Cover Letter', 'Another CV'].map((name) => <div key={name}><FileText /><span className="document-lines"><i /><i /><i /></span><strong>{name}</strong></div>)}</div><p><Check size={15} /> Reuse selected details across your documents.</p></div>
          <div className="career-copy"><h2 id="career-heading">One Workspace.<br />Multiple Career Opportunities.</h2><p>Keep your experience, education, and skills together. Choose the details you need for each CV or cover letter.</p><ul className="benefits"><li><Check />Keep your career details in one place</li><li><Check />Choose relevant experience for each role</li><li><Check />Edit each document independently</li></ul><Link to="/register" className="text-link">Build your career profile <ArrowRight size={17} /></Link></div>
        </section>

        <section className="cta-section container" aria-labelledby="cta-heading"><h2 id="cta-heading">Ready to Build Your Next Professional CV?</h2><p>Create an account to get started, or sign in to your workspace.</p><div className="button-row"><Link className="button button-white" to="/register">Create Free Account <ArrowRight size={18} /></Link><Link className="cta-login" to="/login">Already Have an Account? Login <ArrowRight size={16} /></Link></div></section>
      </main>

      <footer className="site-footer"><div className="container"><div className="footer-main"><div><Link to="/" className="brand"><span className="brand-mark"><Files size={23} /></span><span>Advanced CV<span className="brand-subtitle">& Cover Letter Studio</span></span></Link><p>CVs, cover letters, and application documents.</p></div><nav aria-label="Footer navigation"><a href="#home">Home</a><a href="#features">Features</a><a href="#about">About</a><Link to="/login">Login</Link><Link to="/register">Register</Link></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Advanced CV & Cover Letter Studio.</span></div></div></footer>
    </div>
  );
}
