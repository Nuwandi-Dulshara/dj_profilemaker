import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

function setup() { render(<MemoryRouter><HomePage /></MemoryRouter>); }

describe('public home', () => {
  it('offers account entry and all career-document feature destinations', () => {
    setup();
    expect(screen.getByRole('link', { name: /get started free/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Build Professional CVs & Cover Letters with Confidence');
    const features = screen.getByRole('region', { name: /everything you need/i });
    expect(within(features).getAllByRole('heading', { level: 3 })).toHaveLength(6);
    expect(screen.getByRole('region', { name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /one workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(String(new Date().getFullYear()));
  });

  it('closes mobile navigation on Escape and returns keyboard focus', async () => {
    setup();
    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: /open navigation/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('closes mobile navigation after a section selection', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /open navigation/i }));
    await user.click(within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', { name: 'Features' }));
    expect(screen.getByRole('button', { name: /open navigation/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
