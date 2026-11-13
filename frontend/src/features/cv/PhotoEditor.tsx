import { useMemo, useState } from 'react';
import ImageCropperModal from '../../components/ImageCropperModal';
import type { CvSource } from './integrations';
import { loadPhoto, readPhoto, updatePhoto } from './photo';

export default function PhotoEditor({ source, onChange, disabled }: {source:CvSource; onChange:(source:CvSource)=>void; disabled:boolean}) {
  const photo = useMemo(() => readPhoto(source.html), [source.html]);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return <fieldset className="cv-photo-editor" disabled={disabled || loading}>
    <legend>Optional profile photo</legend>
    <label htmlFor="cv-photo-mode">Photo display in preview and PDF</label>
    <select id="cv-photo-mode" value={photo.visual ? 'visual' : 'ats'} onChange={event => onChange(updatePhoto(source, photo.image, event.target.value === 'visual'))}>
      <option value="ats">ATS-friendly — no profile photo</option>
      <option value="visual">Visual CV — include profile photo</option>
    </select>
    <p className="cv-help">Photo-free by default. Choose Visual CV to include your photo. Save changes before exporting.</p>
    {photo.image && <img className="cv-photo-thumbnail" src={photo.image} alt="Selected profile photo" />}
    <label htmlFor="cv-photo-file">{photo.image ? 'Replace photo' : 'Upload photo'} (JPEG or PNG, up to 5 MB)</label>
    <input id="cv-photo-file" type="file" accept="image/jpeg,image/png" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      setError(''); setLoading(true);
      try { setPending(await loadPhoto(file)); }
      catch (error) { setError(error instanceof Error ? error.message : 'Unable to read this image.'); }
      finally { setLoading(false); }
    }} />
    {loading && <p role="status">Preparing image…</p>}
    {photo.image && <div className="cv-actions">
      <button type="button" className="btn btn-outline" onClick={() => setPending(photo.image)}>Crop / zoom photo</button>
      <button type="button" className="btn btn-outline" onClick={() => { onChange(updatePhoto(source, '', photo.visual)); setError(''); }}>Remove photo</button>
    </div>}
    {error && <p className="cv-error" role="alert">{error}</p>}
    {pending && <ImageCropperModal imageSrc={pending} outputSize={512} onClose={() => setPending('')} onCropComplete={image => onChange(updatePhoto(source, image, photo.visual))} />}
  </fieldset>;
}
