import test from 'node:test';
import assert from 'node:assert/strict';
import { saveCv, createPdf } from '../src/features/cv/integrations.ts';

const source = { title: 'CV', html: '<h1>CV</h1>', css: '' };
const saved = { fileId: 'file123', source, confirmation: 'proof', revision: 'hash', previewHtml: '<h1>CV</h1>' };

test('save waits for retrieval of exactly the source written to Drive', async () => {
  let retrieved = false;
  const result = await saveCv({ drive: {
    saveSource: async () => ({ fileId: 'file123' }),
    loadSource: async () => { retrieved = true; return saved; },
  } }, source);
  assert.equal(retrieved, true);
  assert.equal(result.confirmation, 'proof');
});

test('changed or failed Drive readback never confirms a save', async () => {
  await assert.rejects(saveCv({ drive: {
    saveSource: async () => ({ fileId: 'file123' }),
    loadSource: async () => ({ ...saved, source: { ...source, html: 'changed' } }),
  } }, source), /different|changed/i);
});

test('PDF receives saved file identity and confirmation, not editable source alone', async () => {
  let input;
  await createPdf({ renderPdf: async value => {
    input = value;
    return new Blob(['%PDF-test'], { type: 'application/pdf' });
  } }, saved);
  assert.equal(input.confirmation, 'proof');
  assert.equal(input.fileId, 'file123');
});
