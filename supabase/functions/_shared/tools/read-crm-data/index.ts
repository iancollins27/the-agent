/**
 * Read CRM Data Tool
 * 
 * This tool allows the AI to read data from the CRM system based on a project CRM ID
 * Shared between agent-chat and test-workflow-prompt
 */

import { Tool, ToolContext, ToolResult } from '../types.ts';

// Standard response interface for CRM data
interface CRMResponse {
  project: {
    fields: Record<string, any>;  // All basic project fields
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

class ZohoConnector {
  private supabase: any;
  private config: any;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private defaultDatacenter: string = "com";
  
  constructor(supabase: any, config: any) {
    this.supabase = supabase;
    this.config = config;
    console.log("ZohoConnector initialized with config:", JSON.stringify({
      provider: config.provider_name,
      type: config.provider_type,
      integration_mode: config.integration_mode,
      has_api_key: !!config.api_key,
      has_api_secret: !!config.api_secret,
      has_api_call_json: !!config.api_call_json
    }));
  }

  /**
   * Fetches all CRM data for a project in a standardized format
   */
  async fetchAllData(projectId: string, crmId: string): Promise<{
    data: CRMResponse | null;
    error?: string;
  }> {
    console.log(`Fetching all CRM data for project ID ${projectId} with CRM ID ${crmId}`);
    
    try {
      // Start with an empty response structure
      const response: CRMResponse = {
        project: {
          fields: {},
          notes: [],
          tasks: [],
          contacts: []
        }
      };
      
      // Fetch project fields
      const projectResult = await this.fetchResource('project', crmId);
      if (projectResult.error) {
        console.error(`Error fetching project data: ${projectResult.error}`);
        return { 
          data: null, 
          error: `Failed to fetch project data: ${projectResult.error}`
        };
      }
      
      // Add project fields to response
      if (projectResult.data) {
        response.project.fields = {
          ...projectResult.data,
          id: crmId,
        };
        delete response.project.fields.zoho_fields;
        
        // If there are zoho_fields, add them to the fields object
        if (projectResult.data.zoho_fields) {
          response.project.fields = {
            ...response.project.fields,
            ...projectResult.data.zoho_fields
          };
        }
      }
      
      // Fetch and process all data types in parallel
      const [notesResult, tasksResult, contactsResult] = await Promise.all([
        this.fetchResource('note', null, projectId),
        this.fetchResource('task', null, projectId),
        this.fetchContacts(projectId)
      ]);
      
      // Add notes to response
      if (notesResult.data && Array.isArray(notesResult.data)) {
        response.project.notes = notesResult.data.map(note => ({
          id: note.id || '',
          author: note.author || '',
          timestamp: note.created_at || '',
          content: note.content || '',
          ...note.zoho_fields
        }));
      } else {
        console.warn(`No notes found or invalid notes data format`);
      }
      
      // Add tasks to response
      if (tasksResult.data && Array.isArray(tasksResult.data)) {
        response.project.tasks = tasksResult.data.map(task => ({
          id: task.id || '',
          title: task.title || '',
          status: task.status || '',
          dueDate: task.due_date || null,
          assignee: task.assignee || '',
          ...task.zoho_fields
        }));
      } else {
        console.warn(`No tasks found or invalid tasks data format`);
      }
      
      // Add contacts to response
      if (contactsResult.data && Array.isArray(contactsResult.data)) {
        response.project.contacts = contactsResult.data.map(contact => ({
          id: contact.id || '',
          name: contact.full_name || contact.name || '',
          role: contact.role || '',
          email: contact.email || '',
          phone: contact.phone_number || contact.phone || '',
          ...contact
        }));
      } else {
        console.warn(`No contacts found or invalid contacts data format`);
      }
      
      console.log(`Successfully fetched all CRM data with ${response.project.notes.length} notes, ${response.project.tasks.length} tasks, and ${response.project.contacts.length} contacts`);
      
      return { data: response };
    } catch (error) {
      console.error("Error fetching all CRM data:", error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      };
    }
  }
  
  /**
   * Legacy method to fetch a specific resource type
   */
  async fetchResource(resourceType: string, resourceId: string | null, projectId?: string): Promise<{
    data: any;
    error?: any;
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
        case 'communication':
          return await this.fetchCommunications(projectId || resourceId);
        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }
    } catch (error) {
      console.error(`Error in ZohoConnector.fetchResource:`, error);
      return {
        data: null,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
  
  /**
   * Fetches contacts for a project from our database
   */
  private async fetchContacts(projectId: string): Promise<{
    data: any[];
    error?: string;
  }> {
    try {
      console.log(`Fetching contacts for project ${projectId}`);
      
      // First get contacts linked to this project
      const { data: projectContacts, error: contactsError } = await this.supabase
        .from("project_contacts")
        .select("contact_id")
        .eq("project_id", projectId);
        
      if (contactsError) {
        return { 
          data: [],
          error: `Error fetching project contacts: ${contactsError.message}`
        };
      }
        
      if (!projectContacts || projectContacts.length === 0) {
        console.log(`No contacts found for project ${projectId}`);
        return { data: [] };
      }
      
      const contactIds = projectContacts.map((pc: any) => pc.contact_id);
      console.log(`Found ${contactIds.length} contact IDs for project`);
      
      const { data: contacts, error } = await this.supabase
        .from("contacts")
        .select("id, full_name, email, phone_number, role, contact_type")
        .in("id", contactIds);
        
      if (error) {
        return {
          data: [],
          error: `Error fetching contacts: ${error.message}`
        };
      }
      
      console.log(`Successfully fetched ${contacts.length} contacts for project`);
      return { data: contacts };
    } catch (error) {
      console.error("Error fetching contacts:", error);
      return {
        data: [],
        error: error instanceof Error ? error.message : "Unknown error fetching contacts"
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
        const missingParams = [];
        if (!clientId) missingParams.push("clientId");
        if (!refreshToken) missingParams.push("refreshToken");
        if (!clientSecret) missingParams.push("clientSecret");
        throw new Error(`Missing OAuth credentials: ${missingParams.join(", ")}`);
      }
      
      console.log(`OAuth parameters - Client ID length: ${clientId.length}, Refresh token length: ${refreshToken.length}, Client secret length: ${clientSecret.length}`);
      
      // Determine the auth URL based on datacenter
      const datacenter = apiCallJson.datacenter || this.defaultDatacenter;
      const tokenUrl = `https://accounts.zoho.${datacenter}/oauth/v2/token`;
      
      // Build request for token refresh
      const body = new URLSearchParams();
      body.append('refresh_token', refreshToken);
      body.append('client_id', clientId);
      body.append('client_secret', clientSecret);
      body.append('grant_type', 'refresh_token');
      
      console.log(`Requesting new access token from ${tokenUrl}`);
      
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      };
      
      console.log(`Token request options:`, JSON.stringify({
        url: tokenUrl,
        method: requestOptions.method,
        headers: requestOptions.headers,
        bodyLength: requestOptions.body.length
      }));
      
      const response = await fetch(tokenUrl, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OAuth error response status: ${response.status}, body: ${errorText}`);
        throw new Error(`Zoho OAuth error: ${response.status} - ${errorText}`);
      }
      
      const tokenData = await response.json();
      console.log(`OAuth response received: ${JSON.stringify(tokenData)}`);
      
      if (!tokenData.access_token) {
        console.error(`No access token in response: ${JSON.stringify(tokenData)}`);
        throw new Error("No access token received from Zoho OAuth");
      }
      
      this.accessToken = tokenData.access_token;
      
      // Set token expiry (typically 1 hour for Zoho, minus 5 min buffer)
      this.tokenExpiresAt = now + ((tokenData.expires_in || 3600) - 300) * 1000;
      
      console.log(`New access token obtained (length: ${this.accessToken!.length}), expires at ${new Date(this.tokenExpiresAt).toISOString()}`);
      return this.accessToken!;
    } catch (error) {
      console.error("Error getting Zoho access token:", error);
      throw new Error(`Zoho authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      console.log(`Using token of length: ${token.length}, first 5 chars: ${token.substring(0, 5)}...`);
      
      // Make request
      const headers = {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      console.log(`Request headers:`, JSON.stringify(headers));
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: headers
      });
      
      // Log response headers for debugging
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      console.log(`Response headers:`, JSON.stringify(responseHeaders));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Zoho API error response status: ${response.status}, body: ${errorText}`);
        throw new Error(`Zoho API error: ${response.status} - ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log(`Zoho API response received, sample data: ${JSON.stringify(responseData).substring(0, 100)}...`);
      
      return responseData;
    } catch (error) {
      console.error("Error making Zoho request:", error);
      throw error;
    }
  }
  
  private async fetchProject(crmId: string | null): Promise<{ data: any, error?: any }> {
    if (!crmId) {
      throw new Error("CRM ID is required");
    }
    
    try {
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
      
      // Log configuration details
      console.log(`Zoho Creator config - Account: ${accountOwnerName}, App: ${appLinkName}, Report: ${reportLinkName}, Fields config: ${fieldsConfig}`);
      
      // Construct API endpoint
      const endpoint = `https://${baseUrl}/creator/v2.1/data/${accountOwnerName}/${appLinkName}/report/${reportLinkName}/${crmId}`;
      
      // Set up parameters
      const params: Record<string, string> = {
        field_config: fieldsConfig
      };
      
      if (fieldsConfig === 'custom' && fields) {
        params.fields = fields;
      }
      
      // Make the request
      console.log(`Fetching project data from Zoho for CRM ID: ${crmId}`);
      const response = await this.makeZohoRequest(endpoint, params);
      
      // Extract and transform the data
      const zohoData = response.data || {};
      
      // Create canonical project from Zoho response
      const canonicalProject = {
        id: crmId,
        name: zohoData.Property_ID || zohoData.Name || zohoData.Project_Name || "",
        address: zohoData.Property_Address || "",
        status: zohoData.Status || "",
        next_step: zohoData.Next_Step || "",
        created_at: zohoData.Created_Time || new Date().toISOString(),
        updated_at: zohoData.Modified_Time || new Date().toISOString(),
        summary: zohoData.Description || "",
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
        data: canonicalProject
      };
    } catch (error) {
      console.error("Error fetching project from Zoho:", error);
      return {
        data: null,
        error: error instanceof Error ? error.message : "Failed to fetch project from CRM"
      };
    }
  }
  
  private async fetchTasks(projectId: string | null): Promise<{ data: any[], error?: any }> {
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
        throw new Error("No tasks configuration found in integration settings");
      }
      
      // Prepare endpoint with project CRM ID
      const endpoint = tasksConfig.endpoint.replace('{project_crm_id}', project.crm_id)
                                          .replace('{account_owner_name}', apiCallJson.account_owner_name || this.config.account_id)
                                          .replace('{app_name}', apiCallJson.app_link_name);
      
      // Make request
      const response = await this.makeZohoRequest(endpoint, tasksConfig.params || {});
      
      // Transform data to canonical format
      const tasks = (response.data || []).map((task: any) => ({
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
        data: tasks
      };
    } catch (error) {
      console.error("Error fetching tasks from Zoho:", error);
      return {
        data: [],
        error: error instanceof Error ? error.message : "Failed to fetch tasks from CRM"
      };
    }
  }
  
  private async fetchNotes(projectId: string | null): Promise<{ data: any[], error?: any }> {
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
        throw new Error("No notes configuration found in integration settings");
      }
      
      // Prepare endpoint with project CRM ID
      const endpoint = notesConfig.endpoint.replace('{project_crm_id}', project.crm_id)
                                          .replace('{account_owner_name}', apiCallJson.account_owner_name || this.config.account_id)
                                          .replace('{app_name}', apiCallJson.app_link_name);
      
      // Make request
      const response = await this.makeZohoRequest(endpoint, notesConfig.params || {});
      
      // Transform data to canonical format
      const notes = (response.data || []).map((note: any) => ({
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
        data: notes
      };
    } catch (error) {
      console.error("Error fetching notes from Zoho:", error);
      return {
        data: [],
        error: error instanceof Error ? error.message : "Failed to fetch notes from CRM"
      };
    }
  }
  
  private async fetchCommunications(projectId: string | null): Promise<{ data: any[], error?: any }> {
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
      
      // Check if communications configuration exists
      const commsConfig = apiCallJson.communications;
      if (!commsConfig || !commsConfig.endpoint) {
        return {
          data: [],
          error: "No communications configuration found in integration settings"
        };
      }
      
      // Prepare endpoint with project CRM ID
      const endpoint = commsConfig.endpoint.replace('{project_crm_id}', project.crm_id)
                                          .replace('{account_owner_name}', apiCallJson.account_owner_name || this.config.account_id)
                                          .replace('{app_name}', apiCallJson.app_link_name);
      
      // Make request
      const response = await this.makeZohoRequest(endpoint, commsConfig.params || {});
      
      // Transform data to canonical format (simplified for now)
      const communications = (response.data || []).map((comm: any) => ({
        id: comm.ID || `comm-${Math.random().toString(36).substring(2, 11)}`,
        type: comm.Type || 'Other',
        direction: comm.Direction || 'Outbound',
        content: comm.Content || comm.Body || comm.Text || '',
        timestamp: comm.DateTime || comm.Created_Time || new Date().toISOString(),
        participants: comm.Participants || [],
        zoho_fields: Object.keys(comm).reduce((acc: any, key: string) => {
          if (!['ID', 'Type', 'Direction', 'Content', 'Body', 'Text', 'DateTime', 'Created_Time', 'Participants'].includes(key)) {
            acc[key] = comm[key];
          }
          return acc;
        }, {})
      }));
      
      return {
        data: communications
      };
    } catch (error) {
      console.error("Error fetching communications from Zoho:", error);
      return {
        data: [],
        error: error instanceof Error ? error.message : "Failed to fetch communications from CRM"
      };
    }
  }
}

// Helper function to get contact IDs for a project
async function getContactIds(supabase: any, projectId: string): Promise<string[]> {
  const { data: projectContacts, error } = await supabase
    .from("project_contacts")
    .select("contact_id")
    .eq("project_id", projectId);
    
  if (error || !projectContacts) {
    return [];
  }
  
  return projectContacts.map((pc: any) => pc.contact_id);
}

export const readCrmDataTool: Tool = {
  name: "read_crm_data",
  description: "Retrieves comprehensive data from the CRM system for a project including details, notes, tasks, and contacts",
  schema: {
    type: "object",
    properties: {
      crm_id: {
        type: "string",
        description: "The CRM identifier of the project to retrieve data for"
      },
      entity_type: {
        type: "string",
        enum: ["all", "project", "notes", "tasks", "contacts"],
        description: "Type of entity to retrieve (default: 'all' which fetches everything)"
      }
    },
    required: ["crm_id"]
  },
  
  execute: async (args: any, context: ToolContext): Promise<ToolResult> => {
    const { supabase } = context;
    
    try {
      const { crm_id, entity_type = "all" } = args;
      
      console.log(`Reading CRM data for entity type ${entity_type} with project CRM ID: ${crm_id}`);
      
      // First, find the project by CRM ID
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, company_id")
        .eq("crm_id", crm_id)
        .single();
      
      if (projectError || !project) {
        console.error(`Project lookup error: ${projectError?.message || "Project not found"}`);
        return {
          status: "error",
          error: `Project with CRM ID ${crm_id} not found`,
          message: `Could not find a project with the provided CRM ID: ${crm_id}`
        };
      }
      
      const projectId = project.id;
      const companyId = project.company_id;
      
      console.log(`Found project with ID: ${projectId}, company ID: ${companyId}`);
      
      if (!companyId) {
        return {
          status: "error",
          error: "Company ID not found for this project",
          message: "The project exists but has no associated company"
        };
      }
      
      // Get integration for the company
      const { data: integration, error: integrationError } = await supabase
        .from("company_integrations")
        .select("provider_name, provider_type, api_key, api_secret, account_id, integration_mode, api_call_json")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .single();
        
      if (integrationError || !integration) {
        console.error(`Integration lookup error: ${integrationError?.message || "No integration found"}`);
        return {
          status: "error",
          error: `No active CRM integration found: ${integrationError?.message || "No integration configured"}`,
          message: "This company does not have an active CRM integration configured"
        };
      }
      
      console.log(`Found integration with provider: ${integration.provider_name}`);
      console.log(`Integration details: ${JSON.stringify({
        provider: integration.provider_name,
        type: integration.provider_type,
        mode: integration.integration_mode,
        has_api_key: !!integration.api_key,
        has_api_secret: !!integration.api_secret,
        has_account_id: !!integration.account_id,
        has_call_json: !!integration.api_call_json
      })}`);
      
      // Initialize Zoho connector
      const connector = new ZohoConnector(supabase, {
        ...integration,
        company_id: companyId
      });
      
      let response;
      
      // If requesting all data or entity_type is not specified, fetch everything
      if (entity_type === "all") {
        response = await connector.fetchAllData(projectId, crm_id);
        
        if (response.error) {
          return {
            status: "error",
            error: response.error,
            message: `Failed to retrieve CRM data: ${response.error}`
          };
        }
        
        return {
          status: "success",
          project_id: projectId, 
          company_id: companyId,
          data: response.data,
          message: `Successfully retrieved all project data from CRM for project with ID ${projectId}`
        };
      } 
      else {
        // Handle specific entity type requests using legacy methods
        switch (entity_type) {
          case "project":
            response = await connector.fetchResource('project', crm_id);
            break;
          case "notes":
            response = await connector.fetchResource('note', null, projectId);
            break;
          case "tasks":
            response = await connector.fetchResource('task', null, projectId);
            break;
          case "contacts":
            // Get contacts for this project from our database
            const { data: contacts, error } = await supabase
              .from("contacts")
              .select("*")
              .in("id", await getContactIds(supabase, projectId));
              
            response = { data: contacts, error };
            break;
          default:
            return {
              status: "error",
              error: `Unknown entity type: ${entity_type}`,
              message: `The entity type '${entity_type}' is not supported. Please use one of: all, project, notes, tasks, contacts`
            };
        }
      }
      
      // Check if there was an error in the response
      if (response.error) {
        console.error(`Error in response from ${entity_type} fetch: ${response.error}`);
        return {
          status: "error",
          error: response.error,
          message: `Failed to retrieve ${entity_type} data from CRM: ${response.error}`
        };
      }
      
      const resultData = response.data || [];
      const dataCount = Array.isArray(resultData) ? resultData.length : 1;
      
      console.log(`Successfully retrieved ${entity_type} data, count: ${dataCount}`);
      
      return {
        status: "success",
        entity_type,
        project_id: projectId,
        company_id: companyId,
        data: resultData,
        count: dataCount,
        message: `Successfully retrieved ${dataCount} ${entity_type} records for project with CRM ID ${crm_id}`
      };
    } catch (error) {
      console.error("Error in read_crm_data tool:", error);
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error occurred while reading CRM data",
        message: "Failed to read data from CRM system"
      };
    }
  }
};
