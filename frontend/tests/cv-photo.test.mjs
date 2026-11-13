import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhotoFile } from '../src/features/cv/photo.ts';

test('photo input accepts JPEG/PNG and rejects oversized, empty or unsupported files', () => {
  assert.doesNotThrow(() => validatePhotoFile({type:'image/png', size:1024}));
  assert.doesNotThrow(() => validatePhotoFile({type:'image/jpeg', size:5*1024*1024}));
  assert.throws(() => validatePhotoFile({type:'image/svg+xml', size:100}), /JPEG or PNG/);
  assert.throws(() => validatePhotoFile({type:'image/png', size:0}), /empty/);
  assert.throws(() => validatePhotoFile({type:'image/jpeg', size:5*1024*1024+1}), /5 MB/);
});
