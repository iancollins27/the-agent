
import { BaseConnector, ConnectorConfig, CanonicalProject, CanonicalNote, CanonicalTask } from "../models/connector.ts";

export class ZohoConnector implements BaseConnector {
  private supabase: any;
  private config: ConnectorConfig;
  private authToken: string | null = null;
  
  constructor(supabase: any, config: ConnectorConfig) {
    this.supabase = supabase;
    this.config = config;
  }

  async fetchResource(resourceType: string, resourceId: string | null): Promise<{ data: any, raw?: any }> {
    // For now, handle the case where integration_mode is 'push'
    // In push mode, we actually get data from our database that was pushed from Zoho
    if (this.config.integration_mode === 'push') {
      return await this.fetchFromDatabase(resourceType, resourceId);
    }
    
    // Pull mode implementation would go here in the future
    throw new Error("Pull mode not yet implemented for Zoho");
  }

  private async fetchFromDatabase(resourceType: string, resourceId: string | null): Promise<{ data: any, raw?: any }> {
    try {
      switch (resourceType) {
        case 'project':
          return await this.fetchProject(resourceId);
        case 'note':
          return await this.fetchNotes(resourceId);
        case 'task':
          return await this.fetchTasks(resourceId);
        case 'email':
        case 'sms':
          return await this.fetchCommunications(resourceType, resourceId);
        default:
          throw new Error(`Unsupported resource type: ${resourceType}`);
      }
    } catch (error) {
      console.error(`Error fetching ${resourceType} from database:`, error);
      throw error;
    }
  }

  private async fetchProject(projectId: string | null): Promise<{ data: any, raw?: any }> {
    let query = this.supabase.from('projects').select(`
      id, 
      crm_id, 
      next_step,
      Address,
      Project_status,
      created_at,
      company_id,
      project_track,
      summary,
      last_action_check
    `);

    if (projectId) {
      query = query.eq('id', projectId).maybeSingle();
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch project: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // If single project, also fetch contacts
    let contacts = [];
    if (projectId) {
      const { data: contactData } = await this.supabase
        .from('project_contacts')
        .select(`
          contact_id,
          contacts (
            id,
            full_name,
            email,
            phone_number,
            role
          )
        `)
        .eq('project_id', projectId);

      if (contactData) {
        contacts = contactData.map((pc: any) => ({
          id: pc.contacts?.id,
          name: pc.contacts?.full_name,
          email: pc.contacts?.email,
          phone: pc.contacts?.phone_number,
          role: pc.contacts?.role
        })).filter((c: any) => c.id);
      }
    }

    // Transform to canonical format
    const canonical = this.transformToCanonicalProject(data, contacts);
    
    return {
      data: canonical,
      raw: data
    };
  }

  private async fetchNotes(projectId: string | null): Promise<{ data: any, raw?: any }> {
    if (!projectId) {
      throw new Error("Project ID is required to fetch notes");
    }
    
    // In our current model, notes might be stored in the project summary
    // This is just a placeholder implementation
    const { data, error } = await this.supabase
      .from('projects')
      .select('id, summary')
      .eq('id', projectId)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to fetch project notes: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Since we don't have a dedicated notes table, we'll return a basic structure
    const notes = [{
      id: `note-${projectId}`,
      content: data.summary || "No notes available",
      created_at: new Date().toISOString(),
      author: "System"
    }];

    return {
      data: notes,
      raw: data
    };
  }

  private async fetchTasks(projectId: string | null): Promise<{ data: any, raw?: any }> {
    // Placeholder for task fetching
    // In a real implementation, we would query a tasks table related to the project
    
    if (!projectId) {
      throw new Error("Project ID is required to fetch tasks");
    }

    // Simulate tasks (in production, we'd fetch from a real table)
    const mockTasks: CanonicalTask[] = [
      {
        id: `task-placeholder-${projectId}`,
        title: "Next steps for project",
        description: "Implement actual task storage and retrieval",
        status: "pending",
        created_at: new Date().toISOString()
      }
    ];

    return {
      data: mockTasks,
      raw: { message: "Tasks not yet implemented in database" }
    };
  }

  private async fetchCommunications(type: string, projectId: string | null): Promise<{ data: any, raw?: any }> {
    if (!projectId) {
      throw new Error("Project ID is required to fetch communications");
    }

    // Map the resource type to the communication type in our database
    const commType = type === 'email' ? 'EMAIL' : 'SMS';

    const { data, error } = await this.supabase
      .from('communications')
      .select('*')
      .eq('project_id', projectId)
      .eq('type', commType)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch ${type} communications: ${error.message}`);
    }

    // Transform to canonical format
    const canonicalComms = data.map((comm: any) => ({
      id: comm.id,
      type: comm.type.toLowerCase(),
      direction: comm.direction.toLowerCase(),
      content: comm.content,
      timestamp: comm.created_at,
      participants: comm.participants || [],
      status: comm.status,
      provider: comm.provider
    }));

    return {
      data: canonicalComms,
      raw: data
    };
  }

  private transformToCanonicalProject(project: any, contacts: any[] = []): CanonicalProject {
    return {
      id: project.id,
      name: project.Address || "Unnamed Project",
      status: project.Project_status || "Unknown",
      next_step: project.next_step,
      address: project.Address,
      created_at: project.created_at,
      updated_at: project.last_action_check || project.created_at,
      contacts: contacts,
      crm_id: project.crm_id
    };
  }
}
