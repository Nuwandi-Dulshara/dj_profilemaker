import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';

describe('local development policies', () => {
  for (const [path, heading, other] of [
    ['/terms', 'Terms of Service', '/privacy'],
    ['/privacy', 'Privacy Policy', '/terms'],
  ]) {
    it(`makes ${path} accessible without a session or backend`, () => {
      render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(screen.getByText(/Local development only/)).toBeVisible();
      expect(screen.getByRole('link', { name: 'Back to registration' })).toHaveAttribute('href', '/register');
      expect(screen.getByRole('link', { name: other === '/terms' ? 'Terms of Service' : 'Privacy Policy' })).toHaveAttribute('href', other);
    });
  }
});
