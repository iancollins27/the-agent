import { describe, it, expect, vi } from 'vitest';

vi.mock('../database/contacts.ts', () => ({
  getProjectContacts: vi.fn().mockResolvedValue([
    { id: '1', full_name: 'Jane', role: 'PM' }
  ]),
  formatContactsForContext: vi.fn(() => '- Jane (Role: PM, ID: 1)')
}));

import { prepareContextData } from '../database/utils/contextUtils.ts';
import { getProjectContacts, formatContactsForContext } from '../database/contacts.ts';

describe('prepareContextData', () => {
  it('builds context with contacts and milestone instructions', async () => {
    const projectData = {
      id: 'p1',
      crm_id: 'crm',
      summary: 'sum',
      next_step: 'Install',
      company_id: 'c1',
      project_track: 't1',
      Address: '123 St',
      companies: { name: 'ACME' },
      project_tracks: { name: 'Track', 'track base prompt': 'Base', Roles: 'R' }
    };

    const projectsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: projectData, error: null })
    };
    const milestoneQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { prompt_instructions: 'Do work' } })
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'projects') return projectsQuery;
        if (table === 'project_track_milestones') return milestoneQuery;
        throw new Error('unknown table');
      })
    } as any;

    const { contextData } = await prepareContextData(supabase, 'p1');

    expect(getProjectContacts).toHaveBeenCalledWith(supabase, 'p1');
    expect(formatContactsForContext).toHaveBeenCalled();
    expect(contextData.project_contacts).toContain('Jane');
    expect(contextData.milestone_instructions).toBe('Do work');
    expect(contextData.project_id).toBe('p1');
  });
});
