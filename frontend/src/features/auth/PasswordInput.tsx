import { useState, type InputHTMLAttributes, type Ref } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

export function PasswordInput({ label, error, id, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; ref?: Ref<HTMLInputElement> }) {
  const [visible, setVisible] = useState(false);
  return <div className="form-field"><label htmlFor={id}>{label}</label><div className="input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input {...props} ref={ref} id={id} type={visible ? 'text' : 'password'} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /><button type="button" className="password-toggle" aria-label={`${visible ? 'Hide' : 'Show'} ${label}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{error && <span id={`${id}-error`} className="field-error">{error}</span>}</div>;
}
