import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Copy, X, Check } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface Props {
  slug: string;
  name: string;
  onClose: () => void;
}

export default function QrCodeModal({ slug, name, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const fullUrl = `${window.location.origin}/p/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Unable to copy link.');
    }
  };

  const downloadQr = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug || 'profile'}-qrcode.png`;
    anchor.click();
    toast.success('QR Code downloaded!');
  };

  return (
    <div className="ps-modal-overlay">
      <div className="ps-modal-box qr-modal-box">
        <div className="ps-modal-header">
          <div>
            <h3>Profile QR Code</h3>
            <p className="ps-modal-subtitle">Scan to open {name || 'profile'} on mobile</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="qr-preview-wrapper" ref={qrRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
          <div style={{ padding: '16px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <QRCodeCanvas
              value={fullUrl}
              size={220}
              level="H"
              includeMargin={true}
            />
          </div>
          <p style={{ marginTop: '14px', fontSize: '13px', color: '#64748b', wordBreak: 'break-all', textAlign: 'center' }}>
            {fullUrl}
          </p>
        </div>

        <div className="ps-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button type="button" className="btn btn-outline" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
          <button type="button" className="btn btn-primary" onClick={downloadQr}>
            <Download size={16} /> Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
