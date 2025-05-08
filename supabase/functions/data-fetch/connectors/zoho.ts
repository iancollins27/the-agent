
import { BaseConnector, CanonicalProject, CanonicalContact, CanonicalNote, CanonicalTask } from "../models/connector.ts";

export class ZohoConnector implements BaseConnector {
  private supabase: any;
  private config: any;
  private token: string | null = null;
  private tokenExpiresAt: number = 0;
  
  constructor(supabase: any, config: any) {
    this.supabase = supabase;
    this.config = config;
  }

  async fetchResource(resourceType: string, resourceId: string | null, projectId?: string): Promise<{
    data: any;
    raw?: any;
  }> {
    console.log(`Fetching ${resourceType} for ${resourceId || 'all'} (project: ${projectId || 'none'})`);
    
    try {
      switch(resourceType) {
        case 'project':
          return await this.fetchProject(resourceId);
        case 'task':
          return await this.fetchTasks(projectId || resourceId);
        case 'note':
          return await this.fetchNotes(projectId || resourceId);
        case 'email':
          return await this.fetchEmails(projectId || resourceId);
        case 'sms':
          return await this.fetchSMS(projectId || resourceId);
        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }
    } catch (error) {
      console.error(`Error in ZohoConnector.fetchResource:`, error);
      // Return empty data with error information when API calls fail
      return {
        data: [],
        raw: { error: error.message || "Unknown error occurred" }
      };
    }
  }
  
  private async getAuthToken(): Promise<string> {
    // Check if we have a valid token
    const now = Date.now();
    if (this.token && this.tokenExpiresAt > now) {
      return this.token;
    }
    
    // If we don't have a token or it's expired, get a new one
    try {
      // In a real implementation, we would use the refresh token to get a new token
      // For now, we'll just use the API key from the config
      if (!this.config.api_key) {
        throw new Error("No API key provided in configuration");
      }
      
      // For development, we'll just use the API key as token
      // In production, implement proper OAuth flow with refresh tokens
      this.token = this.config.api_key;
      
      // Set token expiry to 50 minutes (Zoho tokens usually last 60 minutes)
      this.tokenExpiresAt = now + 50 * 60 * 1000;
      
      return this.token;
    } catch (error) {
      console.error("Error getting Zoho auth token:", error);
      throw new Error(`Zoho authentication failed: ${error.message}`);
    }
  }
  
  private async makeZohoRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    try {
      // Get auth token
      const token = await this.getAuthToken();
      
      // Build URL with query params
      let url = endpoint;
      const queryParams = new URLSearchParams(params).toString();
      if (queryParams) {
        url = `${url}?${queryParams}`;
      }
      
      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zoho API error: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error making Zoho request:", error);
      throw error;
    }
  }
  
  private async fetchProject(projectId: string | null): Promise<{ data: CanonicalProject, raw?: any }> {
    if (!projectId) {
      throw new Error("Project ID is required");
    }
    
    try {
      // Get company information and account details
      const { data: company, error: companyError } = await this.supabase
        .from("companies")
        .select("*")
        .eq("id", this.config.company_id)
        .single();
      
      if (companyError) {
        throw new Error(`Could not fetch company information: ${companyError.message}`);
      }
      
      // Get CRM ID from project
      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .select("crm_id")
        .eq("id", projectId)
        .single();
      
      if (projectError || !project) {
        throw new Error(`Could not fetch project CRM ID: ${projectError?.message || "Project not found"}`);
      }
      
      // For development, we'll return a stub response
      // In production, use company.zoho_id and this.config.account_id to build the URL
      console.log(`Would make Zoho API call for project with CRM ID: ${project.crm_id}`);
      
      // Construct the URL we would use in production
      // const baseUrl = "https://www.zohoapis.com"; // This would be dynamic based on datacenter
      // const endpoint = `${baseUrl}/creator/v2.1/data/${this.config.account_id}/${company.zoho_app_link_name}/report/All_Bids/${project.crm_id}`;
      // const response = await this.makeZohoRequest(endpoint);
      
      // For now, return structured mock data
      const mockProject = {
        id: projectId,
        name: `Project for CRM ID ${project.crm_id}`,
        status: "In Progress",
        stage: "Design Review",
        next_step: "Finalize Design",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      return {
        data: mockProject,
        raw: { crm_id: project.crm_id }
      };
    } catch (error) {
      console.error("Error fetching project from Zoho:", error);
      throw error;
    }
  }
  
  private async fetchTasks(projectId: string | null): Promise<{ data: CanonicalTask[], raw?: any }> {
    if (!projectId) {
      throw new Error("Project ID is required");
    }
    
    try {
      // Get CRM ID from project
      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .select("crm_id")
        .eq("id", projectId)
        .single();
      
      if (projectError || !project) {
        throw new Error(`Could not fetch project CRM ID: ${projectError?.message || "Project not found"}`);
      }
      
      console.log(`Would make Zoho API call for tasks related to CRM ID: ${project.crm_id}`);
      
      // In a real implementation, make API call to Zoho to get tasks
      // For now, return mock data
      const mockTasks = [
        {
          id: `task-1-${projectId}`,
          title: "Review design documents",
          description: "Review all architectural plans before submitting",
          status: "In Progress",
          due_date: new Date(Date.now() + 86400000).toISOString(),
          assignee: "John Doe",
          created_at: new Date().toISOString()
        },
        {
          id: `task-2-${projectId}`,
          title: "Submit permit application",
          description: "Submit all required paperwork to the city",
          status: "Pending",
          due_date: new Date(Date.now() + 172800000).toISOString(),
          assignee: "Jane Smith",
          created_at: new Date().toISOString()
        }
      ];
      
      return {
        data: mockTasks,
        raw: { crm_id: project.crm_id }
      };
    } catch (error) {
      console.error("Error fetching tasks from Zoho:", error);
      throw error;
    }
  }
  
  private async fetchNotes(projectId: string | null): Promise<{ data: CanonicalNote[], raw?: any }> {
    if (!projectId) {
      throw new Error("Project ID is required");
    }
    
    try {
      // Get CRM ID from project
      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .select("crm_id")
        .eq("id", projectId)
        .single();
      
      if (projectError || !project) {
        throw new Error(`Could not fetch project CRM ID: ${projectError?.message || "Project not found"}`);
      }
      
      console.log(`Would make Zoho API call for notes related to CRM ID: ${project.crm_id}`);
      
      // In a real implementation, make API call to Zoho to get notes
      // For now, return mock data
      const mockNotes = [
        {
          id: `note-1-${projectId}`,
          content: "Customer requested a change to the roofing material",
          created_at: new Date(Date.now() - 86400000).toISOString(),
          author: "John Doe"
        },
        {
          id: `note-2-${projectId}`,
          title: "Permit Application",
          content: "Permit application submitted, awaiting approval",
          created_at: new Date(Date.now() - 43200000).toISOString(),
          author: "Jane Smith"
        }
      ];
      
      return {
        data: mockNotes,
        raw: { crm_id: project.crm_id }
      };
    } catch (error) {
      console.error("Error fetching notes from Zoho:", error);
      throw error;
    }
  }
  
  private async fetchEmails(projectId: string | null): Promise<{ data: any[], raw?: any }> {
    if (!projectId) {
      throw new Error("Project ID is required");
    }
    
    try {
      // Get CRM ID from project
      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .select("crm_id")
        .eq("id", projectId)
        .single();
      
      if (projectError || !project) {
        throw new Error(`Could not fetch project CRM ID: ${projectError?.message || "Project not found"}`);
      }
      
      console.log(`Would make Zoho API call for emails related to CRM ID: ${project.crm_id}`);
      
      // For now, return empty array
      return {
        data: [],
        raw: { crm_id: project.crm_id }
      };
    } catch (error) {
      console.error("Error fetching emails from Zoho:", error);
      throw error;
    }
  }
  
  private async fetchSMS(projectId: string | null): Promise<{ data: any[], raw?: any }> {
    if (!projectId) {
      throw new Error("Project ID is required");
    }
    
    try {
      // Get CRM ID from project
      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .select("crm_id")
        .eq("id", projectId)
        .single();
      
      if (projectError || !project) {
        throw new Error(`Could not fetch project CRM ID: ${projectError?.message || "Project not found"}`);
      }
      
      console.log(`Would make Zoho API call for SMS messages related to CRM ID: ${project.crm_id}`);
      
      // For now, return empty array
      return {
        data: [],
        raw: { crm_id: project.crm_id }
      };
    } catch (error) {
      console.error("Error fetching SMS from Zoho:", error);
      throw error;
    }
  }
}
