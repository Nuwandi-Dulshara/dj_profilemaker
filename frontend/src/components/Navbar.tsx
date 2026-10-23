import { Link, NavLink } from 'react-router-dom';
import { Layers3 } from 'lucide-react';
export default function Navbar() {
  return <header className="navbar">
    <Link to="/" className="brand"><Layers3 size={27}/><span>Profile Studio Pro</span></Link>
    <nav className="nav-links"><NavLink to="/">Home</NavLink><NavLink to="/dashboard">Dashboard</NavLink><NavLink to="/builder">Builder</NavLink></nav>
    <div className="nav-actions"><Link to="/login" className="btn btn-outline">Login</Link><Link to="/builder" className="btn btn-primary">Get Started</Link></div>
  </header>;
}
