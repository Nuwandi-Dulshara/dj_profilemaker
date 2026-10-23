
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  Share2,
  ShieldCheck,
  UserPlus,
  FilePenLine,
  Globe,
  Layers3,
  ChevronRight,
} from 'lucide-react';

import greatnessImage from '../assets/images/achieving-greatness.png';
import './Home.css';

export default function Home() {
  const features = [
    {
      icon: Eye,
      title: 'Real-Time Live Preview',
      description:
        'Watch your profile take shape instantly as you update your information.',
    },
    {
      icon: Share2,
      title: 'Share Your Profile',
      description:
        'Create a public profile link that you can share with employers, clients and friends.',
    },
    {
      icon: ShieldCheck,
      title: 'Easy Profile Management',
      description:
        'Create, edit, update and manage your digital profiles from one convenient dashboard.',
    },
  ];

  const steps = [
    {
      icon: UserPlus,
      number: '01',
      title: 'Create Your Account',
      description:
        'Register and get started with your personal profile workspace.',
    },
    {
      icon: FilePenLine,
      number: '02',
      title: 'Build Your Profile',
      description:
        'Add your details, skills, experience, photo and social links.',
    },
    {
      icon: Globe,
      number: '03',
      title: 'Share Your Story',
      description:
        'Choose a template, publish your profile and share your link.',
    },
  ];

  return (
    <div className="ps-home" id="top">
      {/* NAVIGATION */}
      <header className="ps-navbar">
        <nav className="ps-nav-container" aria-label="Main navigation">
          <Link to="/" className="ps-brand">
            <span className="ps-brand-icon">
              <Layers3 size={23} strokeWidth={2.4} />
            </span>

            <span>
              Profile Studio <strong>Pro</strong>
            </span>
          </Link>

          <div className="ps-nav-links">
            <a href="#top">Home</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
          </div>

          <div className="ps-nav-actions">
            <Link to="/login" className="ps-login-btn">
              Login
            </Link>

            <Link to="/register" className="ps-register-btn">
              Register <ArrowRight size={16} />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="ps-hero">
          <div className="ps-hero-glow ps-glow-one" />
          <div className="ps-hero-glow ps-glow-two" />

          <div className="ps-hero-container">
            <div className="ps-hero-content">
              <h1>
                Your Profile.
                <br />
                Your Story.
                <br />
                <span>Your Greatness.</span>
              </h1>

              <p className="ps-hero-description">
                Stand out from the crowd with a beautifully designed
                professional profile. Showcase your skills, highlight
                your achievements and share your unique story with
                the world.
              </p>

              <div className="ps-hero-buttons">
                <Link to="/register" className="ps-btn ps-btn-primary">
                  Get Started Free
                  <ArrowRight size={19} />
                </Link>

                <a href="#features" className="ps-btn ps-btn-secondary">
                  Explore Features
                  <ChevronRight size={19} />
                </a>
              </div>

            </div>

            <div className="ps-hero-visual">
              <div className="ps-image-glow" />

              <img
                src={greatnessImage}
                alt="Achieving greatness - climbing toward success"
                className="ps-greatness-image"
                fetchPriority="high"
              />

            </div>
          </div>

          <div className="ps-hero-bottom-fade" />
        </section>

        {/* FEATURES SECTION */}
        <section className="ps-features-section" id="features">
          <div className="ps-section-container">
            <div className="ps-section-heading">
              <h2>
                Everything You Need
                <br />
                <span>To Stand Out</span>
              </h2>

              <p>
                All the essential tools to build, customize and share
                your professional digital identity in one place.
              </p>
            </div>

            <div className="ps-feature-grid">
              {features.map((feature) => {
                const FeatureIcon = feature.icon;

                return (
                  <article
                    className="ps-feature-card"
                    key={feature.title}
                  >
                    <div className="ps-feature-icon">
                      <FeatureIcon size={27} strokeWidth={1.8} />
                    </div>

                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="ps-steps-section" id="how-it-works">
          <div className="ps-section-container">
            <div className="ps-section-heading">
              <h2>
                Three Steps To
                <br />
                <span>Your Digital Profile</span>
              </h2>

              <p>
                From registration to publishing, creating your online
                profile is simple and straightforward.
              </p>
            </div>

            <div className="ps-steps-grid">
              {steps.map((step) => {
                const StepIcon = step.icon;

                return (
                  <article className="ps-step-card" key={step.number}>
                    <span className="ps-step-number">
                      {step.number}
                    </span>

                    <div className="ps-step-icon">
                      <StepIcon size={29} />
                    </div>

                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section className="ps-cta-section">
          <div className="ps-cta-box">
            <div className="ps-cta-decoration" />

            <div className="ps-cta-content">
              <h2>
                Ready To Achieve
                <br />
                <span>Greatness?</span>
              </h2>

              <p>
                Create your account today and start building a profile
                that represents the best version of you.
              </p>

              <Link
                to="/register"
                className="ps-btn ps-btn-primary"
              >
                Create Your Free Account
                <ArrowRight size={19} />
              </Link>

              <p className="ps-cta-login">
                Already have an account?{' '}
                <Link to="/login">Login here</Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="ps-footer">
        <div className="ps-footer-container">
          <Link to="/" className="ps-brand">
            <span className="ps-brand-icon">
              <Layers3 size={20} />
            </span>
            <span>
              Profile Studio <strong>Pro</strong>
            </span>
          </Link>

          <p>
            Build your identity. Achieve greatness.
          </p>

          <div className="ps-footer-links">
            <a href="#features">Features</a>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </div>

          <div className="ps-footer-bottom">
            © {new Date().getFullYear()} Profile Studio Pro.
            All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
