import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Mail, UserRound } from 'lucide-react';
import { api } from '../../services/api';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';
import type { Session } from './AuthProvider';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
interface AuthConfig { registration_enabled: boolean; terms_url: string; privacy_url: string; policy_version: string; development_email: boolean; }
const copy = {
  login: ['Welcome Back!', 'Sign in to continue creating professional CVs and cover letters.', 'Sign In'],
  register: ['Create Your Free Account', 'Create an account to access your workspace.', 'Create Account'],
  forgot: ['Forgot Your Password?', "Enter your email address and we'll help you reset your password.", 'Send Reset Link'],
  reset: ['Create a New Password', 'Choose a strong password to keep your workspace secure.', 'Reset Password'],
};

function formSchema(mode: Mode) {
  return z.object({ first_name: z.string(), last_name: z.string(), email: z.string(), password: z.string(), confirm_password: z.string(), accept_policies: z.boolean(), remember_me: z.boolean() }).superRefine((values, context) => {
    const error = (path: keyof typeof values, message: string) => context.addIssue({ code: 'custom', path: [path], message });
    if (mode !== 'reset' && !z.email().safeParse(values.email.trim()).success) error('email', 'Enter a valid email address.');
    if (mode === 'register') { if (!values.first_name.trim()) error('first_name', 'First name is required.'); if (!values.last_name.trim()) error('last_name', 'Last name is required.'); if (!values.accept_policies) error('accept_policies', 'Please accept the Terms and Privacy Policy.'); }
    if (mode !== 'forgot' && !values.password) error('password', 'Password is required.');
    if (mode === 'register' || mode === 'reset') { if (values.password.length < 10) error('password', 'Use at least 10 characters.'); if (values.password !== values.confirm_password) error('confirm_password', 'Passwords must match.'); }
  });
}

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams();
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('');
  const config = useQuery({ queryKey: ['auth-config'], queryFn: () => api<AuthConfig>('/auth/config/'), staleTime: 60000, retry: false });
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(formSchema(mode)), mode: 'onTouched', defaultValues: { first_name: '', last_name: '', email: '', password: '', confirm_password: '', accept_policies: false, remember_me: false } });
  const password = watch('password');
  const strength = password.length >= 16 ? 3 : password.length >= 10 && /[^a-zA-Z]/.test(password) ? 2 : password.length ? 1 : 0;
  const [heading, description, submitLabel] = copy[mode];
  const blocked = mode === 'register' && !config.data?.registration_enabled;

  const submit = handleSubmit(async (values) => {
    setApiError(''); setNotice('');
    try {
      if (mode === 'login' || mode === 'register') {
        const payload = mode === 'login' ? { email: values.email.trim(), password: values.password, remember_me: values.remember_me } : { ...values, email: values.email.trim(), policy_version: config.data?.policy_version };
        const session = await api<Session>(`/auth/${mode}/`, { method: 'POST', body: JSON.stringify(payload) });
        queryClient.clear(); queryClient.setQueryData(['session'], session); navigate('/dashboard', { replace: true });
      } else if (mode === 'forgot') {
        const result = await api<{ detail: string; development_email: boolean }>('/auth/password-reset/', { method: 'POST', body: JSON.stringify({ email: values.email.trim() }) });
        setNotice(result.development_email ? 'If an eligible account exists, its reset link is available through the development email backend. No email delivery is claimed.' : result.detail);
      } else {
        await api('/auth/password-reset/confirm/', { method: 'POST', body: JSON.stringify({ uid: params.uid, token: params.token, password: values.password, confirm_password: values.confirm_password }) });
        navigate('/login?password=updated', { replace: true });
      }
    } catch (error) { setApiError((error as Error).message); }
  });

  return <AuthLayout register={mode === 'register'}><div className="auth-heading"><h1>{heading}</h1><p>{description}</p></div>
    {mode === 'login' && new URLSearchParams(window.location.search).get('password') === 'updated' && <p className="auth-notice" role="status">Password updated. Sign in with your new password.</p>}
    {mode === 'register' && config.isPending && <p role="status" className="auth-notice">Checking registration availability…</p>}
    {mode === 'register' && config.isError && <p role="alert" className="auth-error">Could not load registration settings. <button type="button" onClick={() => config.refetch()}>Try again</button></p>}
    {mode === 'register' && config.isSuccess && blocked && <p role="status" className="auth-notice">Registration will be available after the site owner configures published Terms and Privacy policies.</p>}
    {apiError && <p className="auth-error" role="alert">{apiError}</p>}{notice && <p className="auth-notice" role="status">{notice}</p>}
    <form onSubmit={submit} noValidate aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting} className="auth-fields">
        {mode === 'register' && <div className="name-fields">{(['first_name', 'last_name'] as const).map((name) => <div className="form-field" key={name}><label htmlFor={name}>{name === 'first_name' ? 'First Name' : 'Last Name'}</label><div className="input-wrap"><UserRound size={17} aria-hidden="true" /><input {...register(name)} id={name} maxLength={150} autoComplete={name === 'first_name' ? 'given-name' : 'family-name'} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} /></div>{errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]?.message}</span>}</div>)}</div>}
        {mode !== 'reset' && <div className="form-field"><label htmlFor="email">Email Address</label><div className="input-wrap"><Mail size={17} aria-hidden="true" /><input {...register('email')} id="email" type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} /></div>{errors.email && <span id="email-error" className="field-error">{errors.email.message}</span>}</div>}
        {mode !== 'forgot' && <PasswordInput {...register('password')} id="password" label={mode === 'reset' ? 'New Password' : 'Password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength={1024} error={errors.password?.message} />}
        {(mode === 'register' || mode === 'reset') && <><div className="password-strength" aria-live="polite"><span className="strength-bars" aria-hidden="true">{[1, 2, 3].map((level) => <i key={level} className={strength >= level ? 'filled' : ''} />)}</span><small>{strength === 0 ? 'At least 10 characters. A unique passphrase works well.' : ['','Add length and variety.', 'Good length. Avoid common or personal phrases.', 'Long passphrase. Keep it unique.'][strength]}</small></div><PasswordInput {...register('confirm_password')} id="confirm_password" label={mode === 'reset' ? 'Confirm New Password' : 'Confirm Password'} autoComplete="new-password" maxLength={1024} error={errors.confirm_password?.message} /></>}
        {mode === 'login' && <div className="auth-options"><label className="checkbox-label"><input type="checkbox" {...register('remember_me')} />Remember Me</label><Link to="/forgot-password">Forgot Password?</Link></div>}
        {mode === 'register' && config.data?.registration_enabled && <div className="policy-field"><label className="checkbox-label"><input type="checkbox" {...register('accept_policies')} aria-describedby={errors.accept_policies ? 'policy-error' : undefined} /><span>I agree to the <a href={config.data.terms_url} target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href={config.data.privacy_url} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>{errors.accept_policies && <span id="policy-error" className="field-error">{errors.accept_policies.message}</span>}</div>}
        <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting || blocked}>{isSubmitting ? 'Please wait…' : submitLabel}<ArrowRight size={17} aria-hidden="true" /></button>
      </fieldset>
    </form>
    <p className="auth-switch">{mode === 'login' ? <>Don’t have an account? <Link to="/register">Create Account</Link></> : mode === 'register' ? <>Already have an account? <Link to="/login">Sign In</Link></> : <Link to="/login">Back to Login</Link>}</p>
  </AuthLayout>;
}
