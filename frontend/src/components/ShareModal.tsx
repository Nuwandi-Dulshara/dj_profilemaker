import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  slug: string;
  name: string;
  title: string;
  onClose: () => void;
}

export default function ShareModal({ slug, name, title, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const profileUrl = `${window.location.origin}/p/${slug}`;
  const shareText = `Check out ${name}'s digital profile (${title}) on Profile Studio Pro:`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Profile URL copied!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const platforms = [
    {
      name: 'WhatsApp',
      color: '#25D366',
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${profileUrl}`)}`,
    },
    {
      name: 'LinkedIn',
      color: '#0077b5',
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c-.95 0-1.72-.78-1.72-1.73a1.73 1.73 0 0 1 3.46 0c0 .95-.78 1.73-1.74 1.73m1.4 9.74v-8.37H5.06v8.37h2.8z" />
        </svg>
      ),
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`,
    },
    {
      name: 'X (Twitter)',
      color: '#1DA1F2',
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`,
    },
    {
      name: 'Facebook',
      color: '#4267B2',
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`,
    },
    {
      name: 'Email',
      color: '#EA4335',
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
      url: `mailto:?subject=${encodeURIComponent(`Digital Profile: ${name}`)}&body=${encodeURIComponent(`${shareText}\n\n${profileUrl}`)}`,
    },
  ];

  return (
    <div className="ps-modal-overlay">
      <div className="ps-modal-box share-modal-box">
        <div className="ps-modal-header">
          <div>
            <h3>Share Profile</h3>
            <p className="ps-modal-subtitle">Share {name}'s portfolio across platforms</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="share-platforms-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', margin: '24px 0' }}>
          {platforms.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="share-platform-btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 6px',
                borderRadius: '12px',
                textDecoration: 'none',
                color: 'inherit',
                background: 'rgba(0,0,0,0.03)',
                transition: 'transform 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: p.color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p.svg}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>{p.name}</span>
            </a>
          ))}
        </div>

        <div className="share-link-copy-box" style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.03)', padding: '6px 10px', borderRadius: '10px', alignItems: 'center' }}>
          <input
            type="text"
            readOnly
            value={profileUrl}
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '13px', outline: 'none' }}
          />
          <button type="button" className="btn btn-primary" onClick={copyUrl} style={{ padding: '6px 14px', fontSize: '12px' }}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
