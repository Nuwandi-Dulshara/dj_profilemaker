import test from 'node:test';
import assert from 'node:assert/strict';
import { saveCv, createPdf, exportPdf, sameSource, cachedPdf } from '../src/features/cv/integrations.ts';

const source = { title: 'CV', html: '<h1>CV</h1>', css: 'h1 { color: navy; }' };
test('missing Drive integration rejects without a saved document', async () => {
  await assert.rejects(saveCv({}, source), /Google Drive.*integration/i);
});
test('Drive errors propagate for retry without changing source', async () => {
  const provider = { saveSource: async () => { throw new Error('Connection expired'); } };
  await assert.rejects(saveCv({ drive: provider }, source), /Connection expired/);
  assert.equal(source.html, '<h1>CV</h1>');
});
test('only a confirmed Drive file ID produces an immutable saved snapshot', async () => {
  const draft = { ...source };
  let release;
  const completion = new Promise(resolve => { release = resolve; });
  const saving = saveCv({ drive: { saveSource: () => completion } }, draft);
  draft.html = '<p>New edits</p>';
  release({ fileId: 'drive-file-123' });
  const saved = await saving;
  assert.equal(saved.fileId, 'drive-file-123');
  assert.equal(saved.source.html, source.html);
  assert.equal(sameSource(draft, saved.source), false);
  assert.equal(Object.isFrozen(saved.source), true);
});
test('empty Drive confirmation is rejected', async () => {
  await assert.rejects(saveCv({ drive: { saveSource: async () => ({ fileId: '' }) } }, source), /confirm/i);
});
test('PDF requires a renderer and a nonempty application/pdf result', async () => {
  const saved = await saveCv({ drive: { saveSource: async () => ({ fileId: '123' }) } }, source);
  await assert.rejects(createPdf({}, saved), /PDF.*integration/i);
  await assert.rejects(createPdf({ renderPdf: async () => new Blob(['bad'], { type: 'text/html' }) }, saved), /valid PDF/i);
  const pdf = new Blob(['%PDF-test'], { type: 'application/pdf' });
  assert.equal(await createPdf({ renderPdf: async input => {
    assert.deepEqual(input, source);
    return pdf;
  } }, saved), pdf);
});
test('PDF exports require provider confirmation and do not save draft source', async () => {
  const pdf = new Blob(['%PDF-test'], { type: 'application/pdf' });
  await assert.rejects(exportPdf(undefined, pdf, 'CV.pdf'), /integration/i);
  await assert.rejects(exportPdf(async () => ({ fileId: '' }), pdf, 'CV.pdf'), /confirm/i);
  const result = await exportPdf(async (blob, name) => {
    assert.equal(blob, pdf);
    assert.equal(name, 'CV.pdf');
    return { fileId: 'pdf-copy' };
  }, pdf, 'CV.pdf');
  assert.equal(result.fileId, 'pdf-copy');
});

test('late PDF rendering for an older save cannot supply a newer saved version', async () => {
  const provider = { drive: { saveSource: async () => ({ fileId: 'same-drive-file' }) } };
  const savedA = await saveCv(provider, source);
  let finish;
  const rendering = new Promise(resolve => { finish = resolve; });
  const pendingPdfA = createPdf({ renderPdf: () => rendering }, savedA);
  const savedB = await saveCv(provider, { ...source, html: '<h1>Updated CV</h1>' }, savedA.fileId);
  const blobA = new Blob(['%PDF-old'], { type: 'application/pdf' });
  finish(blobA);
  const cache = { saved: savedA, blob: await pendingPdfA };
  assert.equal(cachedPdf(savedB, cache), null);
  assert.equal(cachedPdf(savedA, cache), blobA);
});
test('complete documents and long inline styles survive save and render boundaries unchanged', async () => {
  const html = '<!doctype html><html><head><style>' + '.row{display:flex}.col{flex:1}\n'.repeat(12000) +
    '</style></head><body class="container"><div class="row"><section class="col">CV</section></div></body></html>';
  const complete = { title: 'Complete CV', html, css: '' };
  const saved = await saveCv({ drive: { saveSource: async input => {
    assert.equal(input.html, html);
    return { fileId: 'complete-cv' };
  } } }, complete);
  assert.equal(saved.source.html, html);
  await createPdf({ renderPdf: async input => {
    assert.equal(input.html, html);
    assert.equal(input.css, '');
    return new Blob(['%PDF-test'], { type: 'application/pdf' });
  } }, saved);
});
