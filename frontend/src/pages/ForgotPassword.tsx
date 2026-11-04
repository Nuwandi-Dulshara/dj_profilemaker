import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, Layers3 } from 'lucide-react';
import toast from 'react-hot-toast';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      toast.success('Reset link sent to your email!');
    }, 800);
  };

  return (
    <div className="green-auth-page">
      <div className="green-auth-wrapper">
        <div className="green-auth-topbar">
          <Link to="/" className="green-auth-brand">
            <span className="green-auth-brand-icon">
              <Layers3 size={18} />
            </span>
            <span>
              Profile Studio <strong>Pro</strong>
            </span>
          </Link>
          <Link to="/login" className="green-auth-back">
            <ArrowLeft size={15} /> Back to Login
          </Link>
        </div>

        <div className="green-auth-card" style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div className="green-auth-right" style={{ width: '100%', padding: '40px' }}>
            <div className="green-auth-form-box">
              <h1>Forgot Password</h1>
              <p className="green-auth-subtitle">
                Enter your email address and we’ll send you a password reset link.
              </p>

              {submitted ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <CheckCircle2 size={54} color="#10b981" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Check Your Inbox</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.6' }}>
                    We have dispatched a password reset link to <strong>{email}</strong>. Please check your inbox and spam folder.
                  </p>
                  <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '24px' }}>
                    Return to Login
                  </Link>
                </div>
              ) : (
                <form className="green-auth-form" onSubmit={handleSubmit}>
                  <label className="green-field">
                    <span>Email Address</span>
                    <div className="green-input-wrap">
                      <Mail size={18} />
                      <input
                        type="email"
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </label>

                  <button type="submit" className="green-auth-button" disabled={loading}>
                    {loading ? 'Sending link...' : 'Send Reset Link'}
                  </button>

                  <div className="green-auth-switch">
                    Remember your password? <Link to="/login">Login</Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
