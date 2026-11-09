import type { CvSource } from './integrations';

// Preserve document structure and styles, but no scripts, navigation or embedding.
const tags = new Set(('html head body title style a abbr address article aside b blockquote br caption code col colgroup dd div dl dt em ' +
  'figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img li main ol p pre s section small span ' +
  'strong sub sup table tbody td th thead time tr u ul').split(' '));
const attributes = new Set(['class', 'id', 'style', 'title', 'lang', 'dir', 'alt', 'width', 'height', 'colspan', 'rowspan']);

export function buildPreview(source: Readonly<CvSource>): string {
  // A detached document preserves full html/head/body semantics without attaching
  // user content to the application. Scripts stay inert; output runs in an empty sandbox.
  const preview = new DOMParser().parseFromString(source.html, 'text/html');
  for (const node of Array.from(preview.querySelectorAll('*'))) {
    if (!tags.has(node.localName) || node.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      node.remove();
      continue;
    }
    for (const attr of Array.from(node.attributes)) {
      const safeImage = node.localName === 'img' && attr.name === 'src' &&
        /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(attr.value);
      const styleMedia = node.localName === 'style' && attr.name === 'media';
      if (!attributes.has(attr.name) && !safeImage && !styleMedia) node.removeAttribute(attr.name);
    }
  }
  if (!preview.documentElement.lang) preview.documentElement.lang = 'en';

  const policy = preview.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const charset = preview.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const viewport = preview.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1';
  const defaults = preview.createElement('style');
  defaults.textContent = `
* { box-sizing: border-box; }
html { background: #e8edf5; }
body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm; background: white; color: #17233b; font: 11pt/1.5 Arial, sans-serif; overflow-wrap: anywhere; }
img { max-width: 100%; }
h1, h2, h3 { break-after: avoid; }
section, tr { break-inside: avoid; }
@page { size: A4; margin: 0; }
@media print { html { background: white; } body { margin: 0; } }
`;
  // Defaults precede authored CSS, so internal styles keep their normal cascade.
  preview.head.prepend(policy, charset, viewport, defaults);
  // Retain compatibility with previously saved two-field sources. New editing
  // keeps all CSS in source.html and leaves this legacy field empty.
  const legacyCss = preview.createElement('style');
  legacyCss.textContent = source.css.replace(/</g, '\\3c ');
  preview.head.append(legacyCss);
  return `<!doctype html>${preview.documentElement.outerHTML}`;
}
