import { useState, useCallback, useEffect, useRef, useId } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface Props {
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  onClose: () => void;
  outputSize?: number;
}

export default function ImageCropperModal({ imageSrc, onCropComplete, onClose, outputSize }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);

  const onCropChange = (location: { x: number; y: number }) => {
    setCrop(location);
  };

  const onCropCompleteHandler = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const generateCroppedImage = async () => {
    if (!croppedAreaPixels || busy) return;
    setBusy(true); setError('');
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image editing is unavailable in this browser.');

      canvas.width = outputSize ?? croppedAreaPixels.width;
      canvas.height = outputSize ?? croppedAreaPixels.height;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const base64 = canvas.toDataURL('image/jpeg', 0.92);
      onCropComplete(base64);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to crop this image. Please try another image.');
    } finally { setBusy(false); }
  };

  return (
    <div className="ps-modal-overlay">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="ps-modal-box crop-modal-box">
        <div className="ps-modal-header">
          <h3 id={titleId}>Crop Profile Photo</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="cropper-container" style={{ position: 'relative', width: '100%', height: '320px', background: '#0b1329', borderRadius: '12px', overflow: 'hidden' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteHandler}
          />
        </div>

        <div className="crop-controls" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ZoomOut size={18} style={{ color: '#64748b' }} />
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.05}
            aria-label="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <ZoomIn size={18} style={{ color: '#64748b' }} />
        </div>

        <p>Drag the image or use arrow keys on the crop area to position it. Adjust zoom below.</p>
        {error && <p role="alert">{error}</p>}
        <div className="ps-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!croppedAreaPixels || busy} onClick={generateCroppedImage}>
            <Check size={16} /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
