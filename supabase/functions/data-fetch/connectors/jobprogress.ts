
import { BaseConnector, ConnectorConfig, CanonicalProject, CanonicalContact, CanonicalNote, CanonicalTask } from "../models/connector.ts";

export class JobProgressConnector implements BaseConnector {
  private supabase: any;
  private config: ConnectorConfig;
  private baseUrl = "https://api.jobprogress.com/api/v3";

  constructor(supabase: any, config: ConnectorConfig) {
    this.supabase = supabase;
    this.config = config;
  }

  async fetchResource(resourceType: string, resourceId: string | null, projectId?: string): Promise<{ data: any; raw?: any }> {
    try {
      switch (resourceType) {
        case 'project':
          return await this.fetchProject(resourceId || projectId);
        case 'task':
          return await this.fetchTasks(projectId);
        case 'note':
          return await this.fetchNotes(projectId);
        case 'contact':
          return await this.fetchContacts(projectId);
        default:
          throw new Error(`Unsupported resource type: ${resourceType}`);
      }
    } catch (error) {
      console.error(`JobProgress API error for ${resourceType}:`, error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.api_key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`JobProgress API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async fetchProject(jobId: string): Promise<{ data: CanonicalProject; raw?: any }> {
    console.log(`Fetching JobProgress job: ${jobId}`);
    
    const params = {
      'includes[]': 'address,customer,job_schedules'
    };
    
    const response = await this.makeRequest(`/jobs/${jobId}`, params);
    const job = response.data;

    const canonicalProject: CanonicalProject = {
      id: job.id.toString(),
      name: job.name || job.title || 'Untitled Job',
      status: job.status || 'unknown',
      stage: job.stage || job.phase || 'unknown',
      next_step: job.next_step || '',
      address: job.address ? this.formatAddress(job.address) : '',
      created_at: job.created_at || new Date().toISOString(),
      updated_at: job.updated_at || new Date().toISOString(),
      // JobProgress specific fields
      job_number: job.job_number,
      description: job.description,
      start_date: job.start_date,
      completion_date: job.completion_date,
      customer_id: job.customer_id
    };

    return {
      data: canonicalProject,
      raw: job
    };
  }

  private async fetchTasks(projectId: string): Promise<{ data: CanonicalTask[]; raw?: any }> {
    console.log(`Fetching JobProgress tasks for job: ${projectId}`);
    
    const params = {
      job_id: projectId,
      limit: '100'
    };

    const response = await this.makeRequest('/tasks', params);
    const tasks = response.data || [];

    const canonicalTasks: CanonicalTask[] = tasks.map((task: any) => ({
      id: task.id.toString(),
      title: task.title || task.name || 'Untitled Task',
      description: task.description || '',
      status: task.status || 'pending',
      due_date: task.due_date || task.scheduled_date,
      assignee: task.assignee?.name || task.assigned_to,
      created_at: task.created_at || new Date().toISOString(),
      // JobProgress specific fields
      task_type: task.task_type,
      priority: task.priority,
      completion_percentage: task.completion_percentage
    }));

    return {
      data: canonicalTasks,
      raw: tasks
    };
  }

  private async fetchNotes(projectId: string): Promise<{ data: CanonicalNote[]; raw?: any }> {
    console.log(`Fetching JobProgress notes for job: ${projectId}`);
    
    const params = {
      job_id: projectId,
      limit: '100'
    };

    const response = await this.makeRequest('/job_notes', params);
    const notes = response.data || [];

    const canonicalNotes: CanonicalNote[] = notes.map((note: any) => ({
      id: note.id.toString(),
      content: note.note || note.content || '',
      created_at: note.created_at || new Date().toISOString(),
      author: note.author?.name || note.created_by,
      title: note.title || '',
      // JobProgress specific fields
      note_type: note.note_type,
      visibility: note.visibility
    }));

    return {
      data: canonicalNotes,
      raw: notes
    };
  }

  private async fetchContacts(projectId: string): Promise<{ data: CanonicalContact[]; raw?: any }> {
    console.log(`Fetching JobProgress customer for job: ${projectId}`);
    
    // First get the job to find the customer_id
    const jobResponse = await this.makeRequest(`/jobs/${projectId}`, { 'includes[]': 'customer' });
    const job = jobResponse.data;
    
    if (!job.customer) {
      return { data: [], raw: [] };
    }

    const customer = job.customer;
    const canonicalContact: CanonicalContact = {
      id: customer.id.toString(),
      name: customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      email: customer.email || customer.primary_email,
      phone: customer.phone || customer.primary_phone,
      role: 'customer',
      // JobProgress specific fields
      customer_type: customer.customer_type,
      company_name: customer.company_name
    };

    return {
      data: [canonicalContact],
      raw: [customer]
    };
  }

  private formatAddress(address: any): string {
    if (!address) return '';
    
    const parts = [
      address.street_address || address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.zip_code || address.postal_code
    ].filter(Boolean);
    
    return parts.join(', ');
  }
}
