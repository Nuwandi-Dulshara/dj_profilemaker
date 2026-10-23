import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";

type AuthMode = "login" | "register";
interface AuthProps { mode?: AuthMode; }

export default function Auth({ mode = "login" }: AuthProps) {
  const isRegister = mode === "register";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [notice, setNotice] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("This is a frontend demo. Authentication will be connected to Django REST Framework later.");
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-icon"><LockKeyhole size={26} /></div>
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p>{isRegister ? "Join Profile Studio Pro." : "Sign in to manage your profiles."}</p>
        {isRegister && (
          <label className="field"><span>Full Name</span>
            <input required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" />
          </label>
        )}
        <label className="field"><span>Email Address</span>
          <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" />
        </label>
        <label className="field"><span>Password</span>
          <input required type="password" minLength={8} autoComplete={isRegister ? "new-password" : "current-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter password" />
        </label>
        {notice && <p className="info-message" role="status">{notice}</p>}
        <button type="submit" className="btn btn-primary full-width">{isRegister ? "Create Account" : "Sign In"}</button>
        <div className="auth-switch">
          {isRegister ? <>Already have an account? <Link to="/login">Sign In</Link></> : <>Don't have an account? <Link to="/register">Register</Link></>}
        </div>
      </form>
    </div>
  );
}
