import { useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  UserRound,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  Layers3,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import oceanImage from "../assets/images/tropical-ocean.png";
import "./Auth.css";

type AuthMode = "login" | "register";

interface AuthProps {
  mode?: AuthMode;
}

interface AuthForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function Auth({ mode = "login" }: AuthProps) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [form, setForm] = useState<AuthForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setNotice("");
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    setError("");

    if (isRegister && !form.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (isRegister && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register(form.name.trim(), form.email.trim(), form.password);
        setNotice("Account created successfully! Redirecting...");
      } else {
        await login(form.email.trim(), form.password);
        setNotice("Logged in successfully! Redirecting...");
      }
      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
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

          <Link to="/" className="green-auth-back">
            <ArrowLeft size={15} />
            Back to Home
          </Link>
        </div>

        <div className="green-auth-card">
          {/* LEFT SIDE */}
          <div className="green-auth-left">
            <div className="green-blob">
              <div className="green-blob-content">
                <div className="green-left-badge">PROFILE STUDIO PRO</div>

                <div className="green-image-box">
                  <img
                    src={oceanImage}
                    alt="Ocean tropical illustration"
                    className="green-ocean-image"
                  />
                </div>

                <div className="green-left-text">
                  <h2>{isRegister ? "Join Us" : "Welcome Back"}</h2>
                  <p>
                    {isRegister
                      ? "Create your account and start building your digital identity."
                      : "Sign in and continue managing your professional profile beautifully."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="green-auth-right">
            <div className="green-auth-form-box">
              <h1>{isRegister ? "Register" : "Login"}</h1>
              <p className="green-auth-subtitle">
                {isRegister
                  ? "Create your account to get started"
                  : "Enter your credentials to continue"}
              </p>

              <form className="green-auth-form" onSubmit={handleSubmit}>
                {isRegister && (
                  <label className="green-field">
                    <span>Full Name</span>
                    <div className="green-input-wrap">
                      <UserRound size={18} />
                      <input
                        type="text"
                        name="name"
                        placeholder="Enter your full name"
                        value={form.name}
                        onChange={handleChange}
                        autoComplete="name"
                        required
                      />
                    </div>
                  </label>
                )}

                <label className="green-field">
                  <span>Email Address</span>
                  <div className="green-input-wrap">
                    <Mail size={18} />
                    <input
                      type="email"
                      name="email"
                      placeholder="Enter your email"
                      value={form.email}
                      onChange={handleChange}
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <label className="green-field">
                  <span>Password</span>
                  <div className="green-input-wrap">
                    <LockKeyhole size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="green-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                {isRegister && (
                  <label className="green-field">
                    <span>Confirm Password</span>
                    <div className="green-input-wrap">
                      <LockKeyhole size={18} />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Confirm your password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        className="green-password-toggle"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </label>
                )}

                {!isRegister && (
                  <div className="green-auth-links-row">
                    <a href="/" onClick={(e) => e.preventDefault()}>
                      Forgot Password?
                    </a>
                  </div>
                )}

                {error && (
                  <p className="green-message green-error" role="alert">
                    {error}
                  </p>
                )}

                {notice && (
                  <p className="green-message green-success" role="status">
                    {notice}
                  </p>
                )}

                <button type="submit" className="green-auth-button" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Please wait..."
                    : isRegister
                    ? "Create Account"
                    : "Login"}
                </button>

                <div className="green-auth-switch">
                  {isRegister ? (
                    <>
                      Already have an account? <Link to="/login">Login</Link>
                    </>
                  ) : (
                    <>
                      Don&apos;t have an account?{" "}
                      <Link to="/register">Register Now</Link>
                    </>
                  )}
                </div>

                <div className="green-auth-terms">
                  <a href="/" onClick={(e) => e.preventDefault()}>
                    Terms and Services
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}