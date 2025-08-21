import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsConnector } from '../connectors/google-sheets';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  data: vi.fn()
} as any;

// Mock config with test data
const mockConfig = {
  api_key: 'test-api-key',
  provider_name: 'google-sheets',
  provider_type: 'crm',
  integration_mode: 'api_key',
  company_id: 'test-company-id',
  api_call_json: {
    project: {
      spreadsheetId: 'test-spreadsheet-id',
      projectRange: 'Projects!A1:Z100'
    },
    contacts: {
      spreadsheetId: 'test-spreadsheet-id',
      contactsRange: 'Contacts!A1:Z100'
    },
    notes: {
      spreadsheetId: 'test-spreadsheet-id',
      notesRange: 'Notes!A1:Z100'
    },
    tasks: {
      spreadsheetId: 'test-spreadsheet-id',
      tasksRange: 'Tasks!A1:Z100'
    }
  }
};

// Mock fetch implementation
vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
  // Different mock responses based on the URL
  if (url.includes('Projects')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        values: [
          ['id', 'name', 'status', 'address', 'created_at'],
          ['project-1', 'Test Project 1', 'Active', '123 Main St', '2025-08-01'],
          ['project-2', 'Test Project 2', 'Pending', '456 Oak Ave', '2025-08-10']
        ]
      })
    });
  } else if (url.includes('Contacts')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        values: [
          ['id', 'name', 'email', 'phone', 'project_id'],
          ['contact-1', 'John Doe', 'john@example.com', '555-1234', 'project-1'],
          ['contact-2', 'Jane Smith', 'jane@example.com', '555-5678', 'project-1']
        ]
      })
    });
  } else if (url.includes('Notes')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        values: [
          ['id', 'content', 'project_id', 'created_at', 'created_by'],
          ['note-1', 'First meeting notes', 'project-1', '2025-08-05', 'user1'],
          ['note-2', 'Follow-up call', 'project-1', '2025-08-12', 'user2']
        ]
      })
    });
  } else if (url.includes('Tasks')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        values: [
          ['id', 'title', 'description', 'status', 'due_date', 'assignee', 'project_id'],
          ['task-1', 'Create proposal', 'Draft initial proposal', 'Open', '2025-08-15', 'user1', 'project-1'],
          ['task-2', 'Client meeting', 'Prepare presentation', 'In Progress', '2025-08-20', 'user2', 'project-1']
        ]
      })
    });
  } else {
    return Promise.resolve({
      ok: false,
      statusText: 'Not Found',
      text: () => Promise.resolve('Resource not found')
    });
  }
}));

describe('GoogleSheetsConnector', () => {
  let connector: GoogleSheetsConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new GoogleSheetsConnector(mockSupabase, mockConfig);
  });

  describe('fetchResource', () => {
    it('should fetch projects', async () => {
      const result = await connector.fetchResource('project', null);
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('project-1');
      expect(result.data[0].name).toBe('Test Project 1');
      expect(result.data[1].id).toBe('project-2');
    });

    it('should fetch a single project by ID', async () => {
      const result = await connector.fetchResource('project', 'project-1');
      
      expect(result.data).toHaveProperty('id', 'project-1');
      expect(result.data).toHaveProperty('name', 'Test Project 1');
    });

    it('should fetch contacts for a project', async () => {
      const result = await connector.fetchResource('contact', null, 'project-1');
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('contact-1');
      expect(result.data[0].name).toBe('John Doe');
      expect(result.data[1].id).toBe('contact-2');
    });

    it('should fetch notes for a project', async () => {
      const result = await connector.fetchResource('note', null, 'project-1');
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('note-1');
      expect(result.data[0].content).toBe('First meeting notes');
      expect(result.data[1].id).toBe('note-2');
    });

    it('should fetch tasks for a project', async () => {
      const result = await connector.fetchResource('task', null, 'project-1');
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('task-1');
      expect(result.data[0].title).toBe('Create proposal');
      expect(result.data[1].id).toBe('task-2');
    });

    it('should handle unsupported resource types', async () => {
      const result = await connector.fetchResource('unknown', null);
      
      expect(result.data).toEqual([]);
      expect(result.raw).toHaveProperty('error');
      expect(result.raw.error).toContain('Unsupported resource type');
    });
  });
});
