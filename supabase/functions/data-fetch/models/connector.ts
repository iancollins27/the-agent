
export interface BaseConnector {
  fetchResource(resourceType: string, resourceId: string | null, projectId?: string): Promise<{
    data: any;
    raw?: any;
  }>;
}

export interface ConnectorConfig {
  provider_name: string;
  provider_type: string;
  api_key: string;
  api_secret?: string;
  account_id?: string;
  integration_mode: string;
  company_id: string; // Added to allow fetching company-specific configuration
}

// Define the canonical data models for normalized responses
export interface CanonicalProject {
  id: string;
  name?: string;
  status?: string;
  stage?: string;
  next_step?: string;
  address?: string;
  created_at: string;
  updated_at: string;
  contacts?: CanonicalContact[];
  notes?: CanonicalNote[];
  [key: string]: any; // Allow additional fields
}

export interface CanonicalContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  [key: string]: any;
}

export interface CanonicalNote {
  id: string;
  content: string;
  created_at: string;
  author?: string;
  title?: string;
  [key: string]: any;
}

export interface CanonicalTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  due_date?: string;
  assignee?: string;
  created_at: string;
  [key: string]: any;
}

export interface CanonicalCommunication {
  id: string;
  type: string;
  direction: string;
  content: string;
  timestamp: string;
  participants: string[];
  [key: string]: any;
}
