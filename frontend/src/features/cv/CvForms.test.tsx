import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { normalize } from '../../document-engine/schema';
import { PanelEditor } from './CvForms';

it('offers keyboard drag handles and preserves entry content when reordered', async () => {
  function Form() {
    const [doc, setDoc] = useState(normalize({ content: { experience: [{ id: 'a', role: 'First role' }, { id: 'b', role: 'Second role' }] } }));
    return <PanelEditor panel="experience" doc={doc} update={setDoc} />;
  }
  render(<Form />);
  expect(screen.getByRole('button', { name: 'Drag role 1' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Move role 2 up' }));
  expect(screen.getAllByLabelText('Job title')[0]).toHaveValue('Second role');
  expect(screen.getAllByLabelText('Job title')[1]).toHaveValue('First role');
});
