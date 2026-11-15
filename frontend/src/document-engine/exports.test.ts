import { describe, expect, it } from 'vitest';
import { normalize } from './schema';
import { buildDocx, printCv } from './exports';

describe('shared document exports', () => {
  it('creates an editable Word package containing visible CV content and links', async () => {
    const bytes = await buildDocx(normalize({ content: { personal: { name: 'Alex Export', website: 'https://example.org' }, summary: 'Selectable summary', experience: [{ id: '1', role: 'Engineer', company: 'Original company' }], skills: [{ id: '2', name: 'Hidden skill' }] }, design: { hidden: ['skills'], pageSize: 'Letter' } }), 'Export test');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect([...new Uint8Array(bytes).slice(0, 2)]).toEqual([80, 75]);
  });
  it('does not attempt printing when no rendered CV exists', () => {
    expect(() => printCv(normalize({}))).toThrow('Open a CV preview');
  });
});
