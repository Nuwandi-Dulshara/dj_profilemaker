import type { CvSource } from './integrations';

const selector = '#cv-profile-photo';
export function validatePhotoFile(file: Pick<File, 'type' | 'size'>) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPEG or PNG image.');
  if (!file.size) throw new Error('This image is empty. Choose another file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image no larger than 5 MB.');
}

export function readPhoto(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = doc.querySelector(selector);
  const image = container instanceof HTMLTemplateElement ? container.content.querySelector('img') : container?.querySelector('img');
  const src = image?.getAttribute('src') ?? '';
  return { image: /^data:image\/(jpeg|png);base64,[a-z0-9+/=]+$/i.test(src) ? src : '', visual: container?.tagName === 'FIGURE' };
}

/** In photo-free mode the image is retained in inert source only. Both preview
 * sanitizers remove templates, so it never reaches the rendered PDF. */
export function updatePhoto(source: CvSource, image: string, visual: boolean): CvSource {
  const doc = new DOMParser().parseFromString(source.html, 'text/html');
  doc.querySelectorAll(selector).forEach(node => node.remove());
  const container = doc.createElement(visual ? 'figure' : 'template');
  container.id = 'cv-profile-photo';
  if (image) {
    if (!/^data:image\/(jpeg|png);base64,[a-z0-9+/=]+$/i.test(image)) throw new Error('Invalid profile image.');
    const img = doc.createElement('img');
    img.src = image; img.alt = 'Profile photo'; img.width = 112; img.height = 112;
    img.style.cssText = 'width:112px;height:112px;max-width:100%;object-fit:cover;border-radius:8px';
    if (container instanceof HTMLTemplateElement) container.content.append(img);
    else { container.style.cssText = 'margin:0 0 16px;break-inside:avoid'; container.append(img); }
  }
  (doc.querySelector('main') ?? doc.body).prepend(container);
  const fullDocument = /<!doctype\s+html\b|<(?:html|head|body)(?:\s|>)/i.test(source.html);
  // Keep fragment semantics: the preview supplies default page margins only
  // for fragments. Initial style elements may have been parsed into the head.
  return { ...source, html: fullDocument ? '<!doctype html>' + doc.documentElement.outerHTML : doc.head.innerHTML + doc.body.innerHTML };
}

export async function loadPhoto(file: File): Promise<string> {
  validatePhotoFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error('Choose an image smaller than 40 megapixels.');
    }
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image editing is unavailable in this browser.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .9);
  } catch (error) {
    if (error instanceof Error && error.name !== 'EncodingError') throw error;
    throw new Error('This file could not be read as an image. Choose a valid JPEG or PNG.', { cause: error });
  } finally { URL.revokeObjectURL(url); }
}
