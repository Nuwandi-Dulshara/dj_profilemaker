import { Link, useParams } from 'react-router-dom';
import ProfilePreview from '../components/ProfilePreview';
import { readProfiles } from '../utils/storage';
export default function PublicProfile() {
  const {slug} = useParams<{slug: string}>();
  const profile = readProfiles().find(item => item.slug === slug);
  if (!profile) return <div className="not-found"><h1>Profile not found</h1><p>This profile may have been deleted or is saved in a different browser.</p><Link className="btn btn-primary" to="/">Back Home</Link></div>;
  return <div className="public-page"><div className="public-container"><ProfilePreview profile={profile}/></div><p className="public-note">Demo: this profile is stored only in this browser. Real public sharing requires the Django backend.</p></div>;
}
