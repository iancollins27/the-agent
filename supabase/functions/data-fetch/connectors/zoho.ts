
import { BaseConnector, CanonicalProject, CanonicalContact, CanonicalNote, CanonicalTask } from "../models/connector.ts";

export class ZohoConnector implements BaseConnector {
  private supabase: any;
  private config: any;
  private accessToken: string | null = null;
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
  
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now) {
      console.log("Using cached access token");
      return this.accessToken;
    }
    
    console.log("Getting new access token using refresh token");
    
    // If we don't have a token or it's expired, get a new one using refresh token
    try {
      if (!this.config.api_secret) {
        throw new Error("No refresh token provided in configuration");
      }
      
      const refreshToken = this.config.api_secret; // Using api_secret field to store the refresh token
      const clientId = this.config.api_key; // Using api_key field to store the client ID
      
      // Get client secret from integration configuration
      const apiCallJson = this.config.api_call_json || {};
      const clientSecret = apiCallJson.client_secret;
      
      if (!clientId || !refreshToken || !clientSecret) {
        throw new Error("Missing OAuth credentials (client ID, client secret, or refresh token)");
      }
      
      // Determine the auth URL based on datacenter
      const datacenter = apiCallJson.datacenter || "com";
      const tokenUrl = `https://accounts.zoho.${datacenter}/oauth/v2/token`;
      
      // Build request for token refresh
      const body = new URLSearchParams();
      body.append('refresh_token', refreshToken);
      body.append('client_id', clientId);
      body.append('client_secret', clientSecret);
      body.append('grant_type', 'refresh_token');
      
      console.log(`Requesting new access token from ${tokenUrl}`);
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zoho OAuth error: ${response.status} - ${errorText}`);
      }
      
      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      
      // Set token expiry (typically 1 hour for Zoho, minus 5 min buffer)
      this.tokenExpiresAt = now + ((tokenData.expires_in || 3600) - 300) * 1000;
      
      console.log(`New access token obtained, expires at ${new Date(this.tokenExpiresAt).toISOString()}`);
      return this.accessToken;
    } catch (error) {
      console.error("Error getting Zoho access token:", error);
      throw new Error(`Zoho authentication failed: ${error.message}`);
    }
  }
  
  private async makeZohoRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    try {
      // Get access token
      const token = await this.getAccessToken();
      
      // Build URL with query params
      const url = new URL(endpoint);
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
      });
      
      console.log(`Making Zoho API request to: ${url.toString()}`);
      
      // Make request
      const response = await fetch(url.toString(), {
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
      // Get CRM ID from project
      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .select("crm_id, Address, summary, next_step, company_id, companies(name)")
        .eq("id", projectId)
        .single();
      
      if (projectError || !project) {
        throw new Error(`Could not fetch project info: ${projectError?.message || "Project not found"}`);
      }
      
      // Get API call configuration
      const apiCallJson = this.config.api_call_json || {};
      
      // Extract necessary parameters from configuration
      const baseUrl = apiCallJson.base_url || "www.zohoapis.com";
      const accountOwnerName = apiCallJson.account_owner_name || this.config.account_id;
      const appLinkName = apiCallJson.app_link_name;
      const reportLinkName = apiCallJson.report_link_name || "All_Bids";
      const fieldsConfig = apiCallJson.fields_config || "all";
      const fields = apiCallJson.fields;
      
      if (!appLinkName) {
        throw new Error("Missing app_link_name in configuration");
      }
      
      if (!project.crm_id) {
        throw new Error("Project has no CRM ID");
      }
      
      // Construct API endpoint
      const endpoint = `https://${baseUrl}/creator/v2.1/data/${accountOwnerName}/${appLinkName}/report/${reportLinkName}/${project.crm_id}`;
      
      // Set up parameters
      const params: Record<string, string> = {
        field_config: fieldsConfig
      };
      
      if (fieldsConfig === 'custom' && fields) {
        params.fields = fields;
      }
      
      // Make the request
      console.log(`Fetching project data from Zoho for CRM ID: ${project.crm_id}`);
      const response = await this.makeZohoRequest(endpoint, params);
      
      // Extract and transform the data
      const zohoData = response.data || {};
      
      // Create canonical project from Zoho response
      const canonicalProject: CanonicalProject = {
        id: projectId,
        name: zohoData.Property_ID || zohoData.Name || zohoData.Project_Name || project.Address,
        address: zohoData.Property_Address || project.Address,
        status: zohoData.Status || project.Project_status,
        next_step: zohoData.Next_Step || project.next_step,
        created_at: zohoData.Created_Time || new Date().toISOString(),
        updated_at: zohoData.Modified_Time || new Date().toISOString(),
        summary: zohoData.Description || project.summary,
        // Map additional fields from Zoho
        zoho_fields: Object.keys(zohoData).reduce((acc: any, key: string) => {
          // Skip standard fields we've already mapped
          if (!['id', 'Property_ID', 'Name', 'Project_Name', 'Property_Address', 
              'Status', 'Next_Step', 'Created_Time', 'Modified_Time', 'Description'].includes(key)) {
            acc[key] = zohoData[key];
          }
          return acc;
        }, {})
      };
      
      return {
        data: canonicalProject,
        raw: response
      };
    } catch (error) {
      console.error("Error fetching project from Zoho:", error);
      
      // Return basic project info from database if API fails
      try {
        const { data: project } = await this.supabase
          .from("projects")
          .select("id, crm_id, summary, next_step, Address, Project_status, companies(name)")
          .eq("id", projectId)
          .single();
        
        const fallbackProject: CanonicalProject = {
          id: projectId,
          name: project?.Address || 'Unknown Project',
          status: project?.Project_status || 'Unknown',
          next_step: project?.next_step || '',
          address: project?.Address || '',
          summary: project?.summary || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error: error.message
        };
        
        return {
          data: fallbackProject,
          raw: { error: error.message, fallback: true }
        };
      } catch (fallbackError) {
        // If even the fallback fails, throw the original error
        throw error;
      }
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
      
      if (!project.crm_id) {
        throw new Error("Project has no CRM ID");
      }
      
      // Get API call configuration
      const apiCallJson = this.config.api_call_json || {};
      
      // Check if tasks configuration exists
      const tasksConfig = apiCallJson.tasks;
      if (!tasksConfig || !tasksConfig.endpoint) {
        console.log("No tasks configuration found, returning empty list");
        return {
          data: [],
          raw: { warning: "No tasks configuration found" }
        };
      }
      
      // Prepare endpoint with project CRM ID
      const endpoint = tasksConfig.endpoint.replace('{project_crm_id}', project.crm_id);
      
      // Make request
      const response = await this.makeZohoRequest(endpoint, tasksConfig.params || {});
      
      // Transform data to canonical format
      const tasks: CanonicalTask[] = (response.data || []).map((task: any) => ({
        id: task.ID || `task-${Math.random().toString(36).substring(2, 11)}`,
        title: task.Title || task.Name || 'Untitled Task',
        description: task.Description || '',
        status: task.Status || 'Open',
        due_date: task.Due_Date || null,
        assignee: task.Assignee || task.Owner || '',
        created_at: task.Created_Time || new Date().toISOString(),
        priority: task.Priority || 'Normal',
        zoho_fields: Object.keys(task).reduce((acc: any, key: string) => {
          // Skip standard fields we've already mapped
          if (!['ID', 'Title', 'Name', 'Description', 'Status', 'Due_Date', 
              'Assignee', 'Owner', 'Created_Time', 'Priority'].includes(key)) {
            acc[key] = task[key];
          }
          return acc;
        }, {})
      }));
      
      return {
        data: tasks,
        raw: response
      };
    } catch (error) {
      console.error("Error fetching tasks from Zoho:", error);
      return {
        data: [],
        raw: { error: error.message }
      };
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
      
      if (!project.crm_id) {
        throw new Error("Project has no CRM ID");
      }
      
      // Get API call configuration
      const apiCallJson = this.config.api_call_json || {};
      
      // Check if notes configuration exists
      const notesConfig = apiCallJson.notes;
      if (!notesConfig || !notesConfig.endpoint) {
        console.log("No notes configuration found, returning empty list");
        return {
          data: [],
          raw: { warning: "No notes configuration found" }
        };
      }
      
      // Prepare endpoint with project CRM ID
      const endpoint = notesConfig.endpoint.replace('{project_crm_id}', project.crm_id);
      
      // Make request
      const response = await this.makeZohoRequest(endpoint, notesConfig.params || {});
      
      // Transform data to canonical format
      const notes: CanonicalNote[] = (response.data || []).map((note: any) => ({
        id: note.ID || `note-${Math.random().toString(36).substring(2, 11)}`,
        title: note.Title || note.Subject || 'Untitled Note',
        content: note.Content || note.Description || note.Note_Content || '',
        author: note.Created_By || note.Author || '',
        created_at: note.Created_Time || new Date().toISOString(),
        zoho_fields: Object.keys(note).reduce((acc: any, key: string) => {
          // Skip standard fields we've already mapped
          if (!['ID', 'Title', 'Subject', 'Content', 'Description', 'Note_Content', 
              'Created_By', 'Author', 'Created_Time'].includes(key)) {
            acc[key] = note[key];
          }
          return acc;
        }, {})
      }));
      
      return {
        data: notes,
        raw: response
      };
    } catch (error) {
      console.error("Error fetching notes from Zoho:", error);
      return {
        data: [],
        raw: { error: error.message }
      };
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
      
      const apiCallJson = this.config.api_call_json || {};
      const emailsConfig = apiCallJson.emails;
      
      if (!emailsConfig || !emailsConfig.endpoint) {
        return {
          data: [],
          raw: { warning: "No emails configuration found" }
        };
      }
      
      // For now, return empty array
      return {
        data: [],
        raw: { info: "Email fetching not fully implemented" }
      };
    } catch (error) {
      console.error("Error fetching emails from Zoho:", error);
      return {
        data: [],
        raw: { error: error.message }
      };
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
      
      const apiCallJson = this.config.api_call_json || {};
      const smsConfig = apiCallJson.sms;
      
      if (!smsConfig || !smsConfig.endpoint) {
        return {
          data: [],
          raw: { warning: "No SMS configuration found" }
        };
      }
      
      // For now, return empty array
      return {
        data: [],
        raw: { info: "SMS fetching not fully implemented" }
      };
    } catch (error) {
      console.error("Error fetching SMS from Zoho:", error);
      return {
        data: [],
        raw: { error: error.message }
      };
    }
  }
}
