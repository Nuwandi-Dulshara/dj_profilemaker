import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { PasswordInput } from './PasswordInput';

it('allows viewing a password without submitting its form or losing the entered value', async () => {
  render(<form><PasswordInput id="password" label="Password" autoComplete="new-password" /></form>);
  const input = screen.getByLabelText('Password');
  await userEvent.type(input, 'Private-Phrase-81');
  expect(input).toHaveAttribute('type', 'password');
  const toggle = screen.getByRole('button', { name: 'Show Password' });
  expect(toggle).toHaveAttribute('type', 'button');
  await userEvent.click(toggle);
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue('Private-Phrase-81');
  await userEvent.click(screen.getByRole('button', { name: 'Hide Password' }));
  expect(input).toHaveAttribute('type', 'password');
});
