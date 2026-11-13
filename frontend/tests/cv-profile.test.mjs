import test from 'node:test';
import assert from 'node:assert/strict';
import { profileSource } from '../src/features/cv/profileSource.ts';

test('profile CV preserves all sections and escapes authored text', () => {
  const result = profileSource({name:'Jane <Engineer>', title:'Developer', bio:'Builds & tests', email:'jane@example.com', phone:'123', location:'Colombo', skills:[{name:'Python'}], links:[{url:'https://github.com/jane'}], experiences:[{role:'Engineer',company:'Example',startDate:'2020',endDate:'2024',description:'Built APIs'}], education:[{degree:'BSc',institution:'University',fieldOfStudy:'Computing'}], projects:[{title:'API',description:'Real work',tags:'Python',githubUrl:'https://github.com/jane/api'}]}, 'professional');
  assert.ok(result.html.includes('Jane &lt;Engineer&gt;'));
  for (const text of ['Work Experience','Education','Technical Skills','Projects','Built APIs','Computing','https://github.com/jane/api']) assert.ok(result.html.includes(text));
  assert.ok(result.css.includes('A4'));
  assert.ok(result.css.includes('@media print'));
});
