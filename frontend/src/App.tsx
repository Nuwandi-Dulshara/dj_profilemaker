import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Builder from "./pages/Builder";
import PublicProfile from "./pages/PublicProfile";
import Auth from "./pages/Auth";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/p/:slug" element={<PublicProfile />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="*" element={<div className="empty-state container"><h1>404 — Page Not Found</h1><Link to="/" className="btn btn-primary">Back to Home</Link></div>} />
      </Routes>
      <footer className="site-footer">© {new Date().getFullYear()} Profile Studio Pro. Built with React and TypeScript.</footer>
    </BrowserRouter>
  );
}
