import { Link } from 'react-router-dom';
import { ArrowRight, Palette, Eye, Share2, ShieldCheck } from 'lucide-react';
import { demoProfile } from '../data/templates';
import ProfilePreview from '../components/ProfilePreview';
export default function Home() {
  const features = [
    {icon:<Palette size={25}/>,title:'Beautiful Templates',description:'Choose from four unique profile designs.'},
    {icon:<Eye size={25}/>,title:'Live Preview',description:'See changes instantly as you type.'},
    {icon:<Share2 size={25}/>,title:'Share Your Profile',description:'Create a link to your saved profile.'},
    {icon:<ShieldCheck size={25}/>,title:'Easy Management',description:'Create, edit and manage your profiles.'},
  ];
  return <div className="home-page"><section className="hero"><div className="hero-content"><span className="eyebrow">YOUR PERSONAL BRAND STARTS HERE</span><h1>Your Story.<br/>Your Profile.<br/><span>Beautifully Designed.</span></h1><p>Create a stunning digital profile in minutes. Showcase your skills, connect your social accounts and share your professional story.</p><div className="hero-actions"><Link to="/builder" className="btn btn-primary">Create My Profile <ArrowRight size={18}/></Link><Link to="/dashboard" className="btn btn-outline">View Dashboard</Link></div></div><div className="hero-visual"><ProfilePreview profile={demoProfile}/></div></section><section className="features-section"><div className="section-intro"><span className="eyebrow">POWERFUL FEATURES</span><h2>Everything you need to stand out</h2><p>Professional profile creation made simple.</p></div><div className="feature-grid">{features.map(feature => <div className="feature-card" key={feature.title}><div className="feature-icon">{feature.icon}</div><h3>{feature.title}</h3><p>{feature.description}</p></div>)}</div></section></div>;
}
