import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CvDocument } from './CvDocument';
import { normalize } from './schema';

describe('shared template renderer', () => {
  it.each(['single', 'two-column', 'sidebar'])('renders content, custom headings and safe links for %s', layout => {
    const doc = normalize({ content: { personal: { name: 'Alex', website: 'https://example.org' }, summary: 'Original summary', skills: [{ id: 's', name: 'React' }], custom: [{ id: 'c', title: 'Keep this', description: 'Original custom text' }] }, design: { layout, headings: { summary: 'Profile' }, pageBreaks: ['custom'] } });
    render(<CvDocument doc={doc} />);
    expect(screen.getByRole('article')).toHaveAttribute('data-layout', layout);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeVisible();
    expect(screen.getByText('Original custom text')).toBeVisible();
    expect(screen.getByRole('link', { name: 'https://example.org' })).toHaveAttribute('href', 'https://example.org');
    expect(screen.getByText('Keep this').closest('section')).toHaveAttribute('data-page-break', 'true');
  });
  it('normalizes old documents and malformed configuration without losing valid entries', () => {
    const doc = normalize({ content: { personal: { name: { invalid: true } }, skills: [null, { id: 'keep', name: 'Python' }] }, design: { pageSize: 'bad', hidden: null, order: null, headings: null, layout: 'bad' } });
    expect(doc.design.pageSize).toBe('A4');
    render(<CvDocument doc={doc} />);
    expect(screen.getByText('Python')).toBeVisible();
    expect(screen.getByRole('article')).toHaveAttribute('data-layout', 'single');
  });
  it('renders unsafe website strings as text without a clickable script URL', () => {
    render(<CvDocument doc={normalize({ content: { personal: { website: 'javascript:alert(1)' } } })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
