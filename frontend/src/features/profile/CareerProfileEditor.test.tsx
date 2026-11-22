import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { CareerProfileEditor } from './CareerProfileEditor';
import type { CareerProfileData } from '../cv/careerProfile';

afterEach(() => vi.unstubAllGlobals());

it('edits Career Profile sections and saves via PUT /api/career-profile/', async () => {
  const savedPayloads: any[] = [];
  const initialProfile: CareerProfileData = {
    personal: {
      first_name: 'Nuwandi',
      last_name: 'Dulshara',
      email: 'nuwandi@example.com',
      phone: '+94 71 700 1650',
      location: 'Sri Lanka',
      professional_title: 'Software Engineer',
      bio: '',
      linkedin: '',
      github: '',
      portfolio: '',
    },
    summary: 'Full-Stack Engineer.',
    experience: [],
    education: [],
    skills: ['React', 'Python'],
    projects: [],
    certifications: [],
    revision: 1,
    updated_at: '2026-11-22T10:00:00Z',
    percent: 43,
    sections: [],
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/auth/csrf/')) {
        return new Response(JSON.stringify({ csrfToken: 'csrf-token' }));
      }
      if (path.includes('/career-profile/') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        savedPayloads.push(body);
        return new Response(
          JSON.stringify({
            ...initialProfile,
            ...body,
            revision: 2,
          })
        );
      }
      return new Response(JSON.stringify(initialProfile));
    })
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CareerProfileEditor profile={initialProfile} />
    </QueryClientProvider>
  );

  const summaryBox = screen.getByLabelText('Summary');
  await userEvent.clear(summaryBox);
  await userEvent.type(summaryBox, 'Senior Full-Stack Engineer.');

  await userEvent.click(screen.getByRole('button', { name: 'Add experience' }));
  await userEvent.type(screen.getByLabelText('Company'), 'Novagen Development');
  await userEvent.type(screen.getByLabelText('Role / job title'), 'Associate Software Engineer');

  const skillsBox = screen.getByLabelText('Skills (comma separated or one per line)');
  await userEvent.clear(skillsBox);
  await userEvent.type(skillsBox, 'React, Django, PostgreSQL');

  await userEvent.click(screen.getByRole('button', { name: 'Save Career Profile' }));

  await waitFor(() => expect(savedPayloads).toHaveLength(1));
  expect(savedPayloads[0]).toMatchObject({
    summary: 'Senior Full-Stack Engineer.',
    skills: 'React, Django, PostgreSQL',
    experience: [
      expect.objectContaining({
        company: 'Novagen Development',
        role: 'Associate Software Engineer',
      }),
    ],
  });
  expect(await screen.findByText(/Career Profile saved/)).toBeVisible();
});

