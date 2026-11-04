import { useState } from 'react';
import type { FormEvent } from 'react';
import { X, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  profileName: string;
  recipientEmail: string;
  onClose: () => void;
}

export default function ContactModal({ profileName, recipientEmail, onClose }: Props) {
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !senderEmail.trim() || !message.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSending(true);
    // Simulate sending message to profile owner
    setTimeout(() => {
      setIsSending(false);
      toast.success(`Message sent to ${profileName}!`);
      // Also provide mailto fallback if user wants direct email
      if (recipientEmail) {
        const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(
          subject || `Inquiry from ${senderName}`
        )}&body=${encodeURIComponent(`From: ${senderName} (${senderEmail})\n\n${message}`)}`;
        window.location.href = mailtoUrl;
      }
      onClose();
    }, 600);
  };

  return (
    <div className="ps-modal-overlay">
      <div className="ps-modal-box contact-modal-box">
        <div className="ps-modal-header">
          <div>
            <h3>Get in Touch with {profileName}</h3>
            <p className="ps-modal-subtitle">Leave a message or business inquiry</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label className="field">
            <span>Your Name *</span>
            <input
              type="text"
              placeholder="John Doe"
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Your Email *</span>
            <input
              type="email"
              placeholder="john@example.com"
              required
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Subject</span>
            <input
              type="text"
              placeholder="Collaboration or Project Opportunity"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Message *</span>
            <textarea
              rows={4}
              placeholder="Hi Alex, I came across your profile and would love to connect..."
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>

          <div className="ps-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSending}>
              <Send size={15} /> {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
