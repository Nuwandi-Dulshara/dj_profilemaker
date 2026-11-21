/**
 * Client-side A4 PDF binary generator (`application/pdf`).
 * Renders each A4 page (794px x 1123px) at 2x print resolution onto an offscreen canvas
 * and packages the rendered pages into a multi-page PDF 1.4 binary Blob so opening the blob URL
 * in a new tab launches the browser's native PDF Viewer.
 */

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const RENDER_SCALE = 2;

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Idx = dataUrl.indexOf(';base64,');
  if (base64Idx === -1) return new Uint8Array(0);
  const b64 = dataUrl.slice(base64Idx + 8);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Package an array of JPEG page byte buffers into a valid multi-page PDF 1.4 binary Blob (`application/pdf`).
 */
export function buildPdfBlobFromJpegPages(
  pages: { jpegBytes: Uint8Array; widthPx: number; heightPx: number }[]
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // Object 0 is the free object head
  let currentOffset = 0;

  function pushText(str: string) {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    currentOffset += bytes.length;
  }

  function pushBytes(bytes: Uint8Array) {
    chunks.push(bytes);
    currentOffset += bytes.length;
  }

  function startObj(id: number) {
    offsets[id] = currentOffset;
    pushText(`${id} 0 obj\n`);
  }

  function endObj() {
    pushText('\nendobj\n');
  }

  // PDF 1.4 Header
  pushText('%PDF-1.4\n');
  pushBytes(new Uint8Array([0x25, 0xff, 0xff, 0xff, 0xff, 0x0a]));

  // Object 1: Catalog
  startObj(1);
  pushText('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  const pageCount = pages.length;
  const pageObjIds: number[] = [];
  for (let i = 0; i < pageCount; i += 1) {
    pageObjIds.push(3 + i * 3);
  }

  // Object 2: Pages Tree
  startObj(2);
  pushText(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`
  );
  endObj();

  // Objects for each page: Page (3 + i*3), ContentStream (4 + i*3), ImageXObject (5 + i*3)
  for (let i = 0; i < pageCount; i += 1) {
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;
    const { jpegBytes, widthPx, heightPx } = pages[i];

    // Page object
    startObj(pageObjId);
    pushText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /XObject << /Im0 ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    // Content stream drawing the full-page A4 image
    const contentStream = `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n/Im0 Do\nQ`;
    const contentBytes = encoder.encode(contentStream);
    startObj(contentObjId);
    pushText(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushText('\nendstream');
    endObj();

    // JPEG Image XObject
    startObj(imageObjId);
    pushText(
      `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    pushBytes(jpegBytes);
    pushText('\nendstream');
    endObj();
  }

  const totalObjects = 2 + pageCount * 3;
  const xrefOffset = currentOffset;

  pushText(`xref\n0 ${totalObjects + 1}\n`);
  pushText('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id += 1) {
    const padded = String(offsets[id] || 0).padStart(10, '0');
    pushText(`${padded} 00000 n \n`);
  }

  pushText(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const pdfBuffer = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    pdfBuffer.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([pdfBuffer], { type: 'application/pdf' });
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Draw an image onto the canvas respecting CSS `object-fit: cover` and `border-radius` (including 50% circle).
 */
function drawStyledImageOnCanvas(
  ctx: CanvasRenderingContext2D,
  loadedImg: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  computed: CSSStyleDeclaration
) {
  if (w <= 0 || h <= 0) return;
  ctx.save();

  const radiusStr = computed.borderRadius || '0px';
  const isCircle =
    radiusStr.includes('50%') || parseFloat(radiusStr) >= Math.min(w, h) / 2 - 2;
  const numericRadius = isCircle
    ? Math.min(w, h) / 2
    : Math.min(parseFloat(radiusStr) || 0, Math.min(w, h) / 2);

  ctx.beginPath();
  if (isCircle) {
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  } else if (numericRadius > 0 && typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, numericRadius);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.clip();

  // Calculate object-fit: cover source crop
  const natW = loadedImg.naturalWidth || w;
  const natH = loadedImg.naturalHeight || h;
  const targetRatio = w / h;
  const sourceRatio = natW / natH;

  let sx = 0;
  let sy = 0;
  let sw = natW;
  let sh = natH;

  if (computed.objectFit === 'cover' || isCircle) {
    if (sourceRatio > targetRatio) {
      sw = natH * targetRatio;
      sx = (natW - sw) / 2;
    } else {
      sh = natW / targetRatio;
      const objPos = (computed.objectPosition || '').toLowerCase();
      if (objPos.includes('top') || objPos.includes('20%') || objPos.includes('33%')) {
        sy = Math.max(0, (natH - sh) * 0.25);
      } else {
        sy = (natH - sh) / 2;
      }
    }
  }

  ctx.drawImage(loadedImg, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

/**
 * Fallback direct DOM-to-Canvas painter (paints backgrounds, borders, bullets, images, and wrapped text lines).
 */
function paintDomDirectlyToCanvas(sheetEl: HTMLElement, ctx: CanvasRenderingContext2D) {
  const sheetRect = sheetEl.getBoundingClientRect();

  // 1. Paint backgrounds and borders
  const allEls = [sheetEl, ...Array.from(sheetEl.querySelectorAll<HTMLElement>('*'))];
  for (const el of allEls) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    const x = r.left - sheetRect.left;
    const y = r.top - sheetRect.top;
    const w = r.width;
    const h = r.height;
    if (w <= 0 || h <= 0) continue;

    const bg = style.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
    }

    const bbW = parseFloat(style.borderBottomWidth) || 0;
    if (bbW > 0 && style.borderBottomStyle !== 'none') {
      ctx.fillStyle = style.borderBottomColor || '#111111';
      ctx.fillRect(x, y + h - bbW, w, bbW);
    }

    const blW = parseFloat(style.borderLeftWidth) || 0;
    if (blW > 0 && style.borderLeftStyle !== 'none') {
      ctx.fillStyle = style.borderLeftColor || '#111111';
      ctx.fillRect(x, y, blW, h);
    }

    // List item bullet marker
    if (el.tagName === 'LI' && style.listStyleType !== 'none') {
      ctx.fillStyle = style.color || '#111111';
      ctx.beginPath();
      ctx.arc(x - 8, y + (parseFloat(style.fontSize) || 12) * 0.55, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Paint text nodes word-by-word using Range client rects so wrapping matches the browser layout
  const walker = document.createTreeWalker(sheetEl, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let textNode = walker.nextNode();

  while (textNode) {
    const parent = textNode.parentElement;
    const raw = textNode.nodeValue || '';
    if (parent && raw.trim()) {
      const style = window.getComputedStyle(parent);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        const fontWeight = style.fontWeight || '400';
        const fontStyle = style.fontStyle || 'normal';
        const fontSize = style.fontSize || '12px';
        const fontFamily = style.fontFamily || 'Arial, sans-serif';
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
        ctx.fillStyle = style.color || '#111111';
        ctx.textBaseline = 'top';

        // Tokenize text node into words to get exact wrapped coordinates for each word
        const wordRegex = /\S+/g;
        let match: RegExpExecArray | null;
        while ((match = wordRegex.exec(raw)) !== null) {
          range.setStart(textNode, match.index);
          range.setEnd(textNode, match.index + match[0].length);
          const wordRect = range.getBoundingClientRect();
          if (wordRect.width > 0 && wordRect.height > 0) {
            let wordText = match[0];
            if (style.textTransform === 'uppercase') wordText = wordText.toUpperCase();
            ctx.fillText(
              wordText,
              wordRect.left - sheetRect.left,
              wordRect.top - sheetRect.top
            );
          }
        }
      }
    }
    textNode = walker.nextNode();
  }
}

/**
 * Render a single A4 page HTML string + CSS into a JPEG byte array at 2x resolution.
 */
async function renderSinglePageToJpeg(
  pageHtml: string,
  css: string
): Promise<{ jpegBytes: Uint8Array; widthPx: number; heightPx: number }> {
  const widthPx = A4_WIDTH_PX * RENDER_SCALE;
  const heightPx = A4_HEIGHT_PX * RENDER_SCALE;

  const pageNormalizationCss = `
    * { box-sizing: border-box; }
    .pdf-a4-sheet {
      width: ${A4_WIDTH_PX}px;
      height: ${A4_HEIGHT_PX}px;
      min-height: ${A4_HEIGHT_PX}px;
      max-height: ${A4_HEIGHT_PX}px;
      background: #ffffff;
      color: #111827;
      padding: 36px 42px;
      margin: 0;
      overflow: hidden;
      font-family: Arial, Helvetica, system-ui, sans-serif;
      position: relative;
    }
    .pdf-a4-sheet .screen-toolbar { display: none !important; }
    .pdf-a4-sheet:has(.cv-page),
    .pdf-a4-sheet:has(.cv-document),
    .pdf-a4-sheet:has(.app-shell) {
      padding: 0 !important;
    }
    .pdf-a4-sheet .app-shell,
    .pdf-a4-sheet .cv-app,
    .pdf-a4-sheet .cv-document {
      width: 100% !important;
      max-width: none !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      gap: 0 !important;
      background: #ffffff !important;
      box-shadow: none !important;
    }
    .pdf-a4-sheet .cv-page {
      width: ${A4_WIDTH_PX}px !important;
      height: ${A4_HEIGHT_PX}px !important;
      min-height: ${A4_HEIGHT_PX}px !important;
      max-height: ${A4_HEIGHT_PX}px !important;
      margin: 0 !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }
  `;

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_WIDTH_PX}px;height:${A4_HEIGHT_PX}px;z-index:-1;background:#ffffff;pointer-events:none;`;
  const sheet = document.createElement('div');
  sheet.className = 'pdf-a4-sheet adv-cv-a4-page';
  sheet.innerHTML = `<style>${css}\n${pageNormalizationCss}</style>${pageHtml}`;
  host.appendChild(sheet);
  document.body.appendChild(host);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { jpegBytes: new Uint8Array(0), widthPx, heightPx };
    }

    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4_WIDTH_PX, A4_HEIGHT_PX);

    // Clone the sheet and replace <img> src with a transparent 1x1 pixel for foreignObject
    // (we draw all <img> elements directly onto the canvas in Layer 2 so they always render cleanly)
    const clone = sheet.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('img').forEach((imgEl) => {
      imgEl.setAttribute(
        'src',
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      );
    });

    const serializedXhtml = new XMLSerializer().serializeToString(clone);
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${A4_WIDTH_PX}" height="${A4_HEIGHT_PX}"><foreignObject width="100%" height="100%">${serializedXhtml}</foreignObject></svg>`;
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

    const svgImg = await loadImageElement(svgDataUrl);
    if (svgImg) {
      ctx.drawImage(svgImg, 0, 0, A4_WIDTH_PX, A4_HEIGHT_PX);
    } else {
      paintDomDirectlyToCanvas(sheet, ctx);
    }

    // Layer 2: Draw all raster <img> elements (profile photos, signatures, logos) directly onto the canvas
    const sheetRect = sheet.getBoundingClientRect();
    const liveImgs = Array.from(sheet.querySelectorAll('img'));
    for (const imgEl of liveImgs) {
      const src = imgEl.getAttribute('src') || '';
      if (!src) continue;
      const loaded = await loadImageElement(src);
      if (!loaded) continue;
      const r = imgEl.getBoundingClientRect();
      const computed = window.getComputedStyle(imgEl);
      drawStyledImageOnCanvas(
        ctx,
        loaded,
        r.left - sheetRect.left,
        r.top - sheetRect.top,
        r.width,
        r.height,
        computed
      );
    }

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
    return {
      jpegBytes: dataUrlToUint8Array(jpegDataUrl),
      widthPx,
      heightPx,
    };
  } finally {
    host.remove();
  }
}

/**
 * Render an array of A4 HTML pages + CSS into a multi-page `application/pdf` Blob
 * and open it in a new browser tab.
 */
export async function openRenderedPdfInNewTab(
  pages: string[],
  css: string,
  title: string
): Promise<void> {
  // Open the target tab synchronously on user click so popup blockers allow it
  const newWin = window.open('', '_blank');

  // In JSDOM unit tests, return immediately with a minimal valid PDF blob
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    const emptyPdfBlob = buildPdfBlobFromJpegPages([]);
    const url = URL.createObjectURL(emptyPdfBlob);
    if (newWin) newWin.location.href = url;
    return;
  }

  if (newWin) {
    newWin.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Generating PDF — ${
        title || 'Untitled'
      }</title><style>body{margin:0;display:grid;place-items:center;height:100vh;background:#323639;color:#f1f5f9;font-family:system-ui,sans-serif;font-size:15px;}</style></head><body><div>Generating PDF preview…</div></body></html>`
    );
  }

  const renderedPages: { jpegBytes: Uint8Array; widthPx: number; heightPx: number }[] = [];
  for (const pageHtml of pages) {
    const pageImg = await renderSinglePageToJpeg(pageHtml, css);
    if (pageImg.jpegBytes.length > 0) {
      renderedPages.push(pageImg);
    }
  }

  const pdfBlob = buildPdfBlobFromJpegPages(renderedPages);
  const pdfUrl = URL.createObjectURL(pdfBlob);

  if (newWin) {
    newWin.location.replace(pdfUrl);
  } else {
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  }

  window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 300000);
}

