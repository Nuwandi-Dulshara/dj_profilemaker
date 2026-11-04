import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface Props {
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  onClose: () => void;
}

export default function ImageCropperModal({ imageSrc, onCropComplete, onClose }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

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
    if (!croppedAreaPixels) return;
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      const base64 = canvas.toDataURL('image/jpeg', 0.92);
      onCropComplete(base64);
      onClose();
    } catch (err) {
      console.error('Failed to crop image', err);
    }
  };

  return (
    <div className="ps-modal-overlay">
      <div className="ps-modal-box crop-modal-box">
        <div className="ps-modal-header">
          <h3>Crop Profile Photo</h3>
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

        <div className="ps-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={generateCroppedImage}>
            <Check size={16} /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
