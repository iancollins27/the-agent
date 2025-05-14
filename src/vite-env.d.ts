
/// <reference types="vite/client" />

// CRM Data Types
interface CRMResponse {
  project: {
    fields: Record<string, any>;
    notes: Array<{
      id: string;
      author: string;
      timestamp: string;
      content: string;
      [key: string]: any;
    }>;
    contacts: Array<{
      id: string;
      name: string;
      role: string;
      email: string;
      phone: string;
      [key: string]: any;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      dueDate: string | null;
      assignee: string;
      [key: string]: any;
    }>;
  }
}
