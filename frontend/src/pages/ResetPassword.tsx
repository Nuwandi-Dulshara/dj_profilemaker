import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockKeyhole, ArrowLeft, Eye, EyeOff, Layers3 } from 'lucide-react';
import toast from 'react-hot-toast';
import './Auth.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('Password successfully reset! Please login.');
      navigate('/login');
    }, 700);
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
              <h1>Set New Password</h1>
              <p className="green-auth-subtitle">
                Enter your new secure password below.
              </p>

              <form className="green-auth-form" onSubmit={handleSubmit}>
                <label className="green-field">
                  <span>New Password</span>
                  <div className="green-input-wrap">
                    <LockKeyhole size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="green-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <label className="green-field">
                  <span>Confirm New Password</span>
                  <div className="green-input-wrap">
                    <LockKeyhole size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                </label>

                <button type="submit" className="green-auth-button" disabled={loading}>
                  {loading ? 'Updating...' : 'Reset Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
