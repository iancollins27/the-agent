import { BaseConnector, CanonicalProject, CanonicalContact, CanonicalNote, CanonicalTask, ConnectorConfig } from "../models/connector.ts";

// Extended connector config with Google Sheets specific fields
interface GoogleSheetsConfig extends ConnectorConfig {
  api_call_json?: {
    project?: {
      spreadsheetId: string;
      projectRange: string;
    };
    contacts?: {
      spreadsheetId: string;
      contactsRange: string;
    };
    notes?: {
      spreadsheetId: string;
      notesRange: string;
    };
    tasks?: {
      spreadsheetId: string;
      tasksRange: string;
    };
  };
}

/**
 * Google Sheets Connector for fetching data from Google Sheets
 * Implements the BaseConnector interface
 */
export class GoogleSheetsConnector implements BaseConnector {
  private supabase: any;
  private config: GoogleSheetsConfig;
  
  constructor(supabase: any, config: GoogleSheetsConfig) {
    this.supabase = supabase;
    this.config = config;
    
    if (!this.config.api_key) {
      throw new Error("Google Sheets API key is missing.");
    }
  }

  /**
   * Main method to fetch resources from Google Sheets
   * @param resourceType Type of resource to fetch (project, contact, note, task)
   * @param resourceId ID of the specific resource to fetch (null for all)
   * @param projectId Optional project ID for related resources
   * @returns Promise with data and raw response
   */
  async fetchResource(resourceType: string, resourceId: string | null, projectId?: string): Promise<{
    data: any;
    raw?: any;
  }> {
    console.log(`[GoogleSheetsConnector] Fetching ${resourceType} for ${resourceId || 'all'} (project: ${projectId || 'none'})`);
    
    try {
      switch(resourceType.toLowerCase()) {
        case 'project':
          return await this.fetchProject(resourceId !== null ? resourceId : projectId || null);
        case 'contact':
          return await this.fetchContacts(projectId || resourceId || null);
        case 'note':
          return await this.fetchNotes(projectId || resourceId || null);
        case 'task':
          return await this.fetchTasks(projectId || resourceId || null);
        default:
          throw new Error(`Unsupported resource type for Google Sheets: ${resourceType}`);
      }
    } catch (error) {
      console.error(`Error in GoogleSheetsConnector.fetchResource:`, error);
      return {
        data: [] as CanonicalProject[],
        raw: { error: error instanceof Error ? error.message : 'Unknown error occurred' }
      };
    }
  }
  
  /**
   * Fetches project data from Google Sheets
   * @param projectId Optional project ID to filter by
   * @returns Promise with project data
   */
  private async fetchProject(projectId: string | null): Promise<{ data: CanonicalProject | CanonicalProject[]; raw?: any }> {
    try {
      if (projectId) {
        return await this.fetchSingleProject(projectId);
      } else {
        return await this.fetchAllProjects();
      }
    } catch (error) {
      console.error("Error in fetchProject:", error);
      return { 
        data: [] as CanonicalProject[], 
        raw: { error: error instanceof Error ? error.message : 'Unknown error occurred' } 
      };
    }
  }

  /**
   * Fetches a single project by ID
   */
  private async fetchSingleProject(projectId: string): Promise<{ data: CanonicalProject; raw?: any }> {
    try {
      // Get project configuration from api_call_json
      const apiCallJson = this.config.api_call_json || {};
      const projectConfig = apiCallJson.project || {};
      
      if (!projectConfig.spreadsheetId || !projectConfig.projectRange) {
        throw new Error("Google Sheets project configuration is missing spreadsheetId or projectRange");
      }
      
      // Fetch project data from Google Sheets
      const response = await this.getSheetData(
        projectConfig.spreadsheetId,
        projectConfig.projectRange
      );
      
      if (!response.values || response.values.length < 2) {
        throw new Error("No project data found or invalid format");
      }
      
      // Assume first row contains headers
      const headers = response.values[0];
      
      // Find the project with matching ID
      const projectRow = response.values.slice(1).find((row: any[]) => {
        const idIndex = headers.indexOf('id');
        return idIndex >= 0 && row[idIndex] === projectId;
      });
      
      if (!projectRow) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      // Convert to canonical project format
      const project = this.normalizeProject(headers, projectRow);
      
      return {
        data: project,
        raw: response
      };
    } catch (error) {
      console.error("Error fetching single project:", error);
      return {
        data: null as unknown as CanonicalProject,
        raw: { error: error instanceof Error ? error.message : 'Unknown error occurred' }
      };
    }
  }
  
  /**
   * Fetches all projects
   */
  private async fetchAllProjects(): Promise<{ data: CanonicalProject[]; raw?: any }> {
    try {
      // Get project configuration from api_call_json
      const apiCallJson = this.config.api_call_json || {};
      const projectConfig = apiCallJson.project || {};
      
      if (!projectConfig.spreadsheetId || !projectConfig.projectRange) {
        throw new Error("Google Sheets project configuration is missing spreadsheetId or projectRange");
      }
      
      // Fetch project data from Google Sheets
      const response = await this.getSheetData(
        projectConfig.spreadsheetId,
        projectConfig.projectRange
      );
      
      if (!response.values || response.values.length < 2) {
        throw new Error("No project data found or invalid format");
      }
      
      // Assume first row contains headers
      const headers = response.values[0];
      
      // Convert all rows to canonical project format
      const projects = response.values.slice(1).map((row: any[]) => 
        this.normalizeProject(headers, row)
      );
      
      return {
        data: projects,
        raw: response
      };
    } catch (error) {
      console.error("Error fetching all projects:", error);
      return {
        data: [],
        raw: { error: error instanceof Error ? error.message : 'Unknown error occurred' }
      };
    }
  }
  
  /**
   * Normalizes a row of project data to CanonicalProject format
   */
  private normalizeProject(headers: string[], row: any[]): CanonicalProject {
    // Create a map of header to value
    const projectData: Record<string, any> = {};
    headers.forEach((header: string, index: number) => {
      if (index < row.length) {
        projectData[header] = row[index];
      }
    });
    
    // Map to canonical project format
    return {
      id: projectData.id || `gs-${Math.random().toString(36).substring(2, 11)}`,
      name: projectData.name || projectData.title || 'Untitled Project',
      status: projectData.status || 'Unknown',
      stage: projectData.stage || projectData.phase || '',
      next_step: projectData.next_step || projectData.next_action || '',
      address: projectData.address || projectData.location || '',
      created_at: projectData.created_at || new Date().toISOString(),
      updated_at: projectData.updated_at || projectData.modified_at || new Date().toISOString(),
      // Include all original fields
      ...projectData
    };
  }
  
  /**
   * Fetches contact data from Google Sheets
   * @param projectId Optional project ID to filter contacts by
   * @returns Promise with contact data
   */
  private async fetchContacts(projectId: string | null): Promise<{ data: CanonicalContact[]; raw?: any }> {
    try {
      if (!this.config.api_call_json?.contacts) {
        throw new Error("Google Sheets contacts configuration is missing.");
      }
      
      const contactsConfig = this.config.api_call_json.contacts;
      
      // Fetch data from Google Sheets API
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${contactsConfig.spreadsheetId}/values/${contactsConfig.contactsRange}?key=${this.config.api_key}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch contacts data: ${response.statusText}`);
      }
      
      const data = await response.json();
      const rows = data.values || [];
      
      if (rows.length <= 1) {
        // Only header row or empty
        return { data: [], raw: data };
      }
      
      // Assume first row is header
      const headers = rows[0];
      const contacts: CanonicalContact[] = [];
      
      // Process each row (skip header)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const contact: CanonicalContact = {
          id: this.getValueByHeader(row, headers, "id") || `gs-contact-${i}`,
          name: this.getValueByHeader(row, headers, "name") || "",
          email: this.getValueByHeader(row, headers, "email") || "",
          phone: this.getValueByHeader(row, headers, "phone") || "",
          project_id: this.getValueByHeader(row, headers, "project_id") || "",
          source_id: this.getValueByHeader(row, headers, "source_id") || `gs-contact-${i}`,
          source_data: row.reduce((obj: any, val: string, idx: number) => {
            if (idx < headers.length) {
              obj[headers[idx]] = val;
            }
            return obj;
          }, {})
        };
        
        // Filter by project ID if provided
        if (!projectId || contact.project_id === projectId) {
          contacts.push(contact);
        }
      }
      
      return { data: contacts, raw: data };
    } catch (error) {
      console.error("Error fetching contacts from Google Sheets:", error);
      return { 
        data: [] as CanonicalContact[], 
        raw: { error: error instanceof Error ? error.message : 'Unknown error occurred' } 
      };
    }
  }
  
  /**
   * Fetches notes data from Google Sheets
   * @param projectId Optional project ID to filter notes by
   * @returns Promise with notes data
   */
  private async fetchNotes(projectId: string | null): Promise<{ data: CanonicalNote[]; raw?: any }> {
    try {
      if (!this.config.api_call_json?.notes) {
        throw new Error("Google Sheets notes configuration is missing.");
      }
      
      const notesConfig = this.config.api_call_json.notes;
      
      // Fetch data from Google Sheets API
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${notesConfig.spreadsheetId}/values/${notesConfig.notesRange}?key=${this.config.api_key}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch notes data: ${response.statusText}`);
      }
      
      const data = await response.json();
      const rows = data.values || [];
      
      if (rows.length <= 1) {
        // Only header row or empty
        return { data: [], raw: data };
      }
      
      // Assume first row is header
      const headers = rows[0];
      const notes: CanonicalNote[] = [];
      
      // Process each row (skip header)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const note: CanonicalNote = {
          id: this.getValueByHeader(row, headers, "id") || `gs-note-${i}`,
          content: this.getValueByHeader(row, headers, "content") || "",
          project_id: this.getValueByHeader(row, headers, "project_id") || "",
          created_at: this.getValueByHeader(row, headers, "created_at") || new Date().toISOString(),
          created_by: this.getValueByHeader(row, headers, "created_by") || "",
          source_id: this.getValueByHeader(row, headers, "source_id") || `gs-note-${i}`,
          source_data: row.reduce((obj: any, val: string, idx: number) => {
            if (idx < headers.length) {
              obj[headers[idx]] = val;
            }
            return obj;
          }, {})
        };
        
        // Filter by project ID if provided
        if (!projectId || note.project_id === projectId) {
          notes.push(note);
        }
      }
      
      return { data: notes, raw: data };
    } catch (error) {
      console.error("Error fetching notes from Google Sheets:", error);
      return { 
        data: [] as CanonicalNote[], 
        raw: { error: error instanceof Error ? error.message : 'Unknown error occurred' } 
      };
    }
  }
  
  /**
   * Fetches tasks data from Google Sheets
   * @param projectId Optional project ID to filter tasks by
   * @returns Promise with tasks data
   */
  private async fetchTasks(projectId: string | null): Promise<{ data: CanonicalTask[]; raw?: any }> {
    try {
      if (!this.config.api_call_json?.tasks) {
        throw new Error("Google Sheets tasks configuration is missing.");
      }
      
      const tasksConfig = this.config.api_call_json.tasks;
      
      // Fetch data from Google Sheets API
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${tasksConfig.spreadsheetId}/values/${tasksConfig.tasksRange}?key=${this.config.api_key}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks data: ${response.statusText}`);
      }
      
      const data = await response.json();
      const rows = data.values || [];
      
      if (rows.length <= 1) {
        // Only header row or empty
        return { data: [], raw: data };
      }
      
      // Assume first row is header
      const headers = rows[0];
      const tasks: CanonicalTask[] = [];
      
      // Process each row (skip header)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const task: CanonicalTask = {
          id: this.getValueByHeader(row, headers, "id") || `gs-task-${i}`,
          title: this.getValueByHeader(row, headers, "title") || `Task ${i}`,
          description: this.getValueByHeader(row, headers, "description") || "",
          status: this.getValueByHeader(row, headers, "status") || "",
          due_date: this.getValueByHeader(row, headers, "due_date") || "",
          assignee: this.getValueByHeader(row, headers, "assignee") || "",
          project_id: this.getValueByHeader(row, headers, "project_id") || "",
          created_at: this.getValueByHeader(row, headers, "created_at") || new Date().toISOString(),
          source_id: this.getValueByHeader(row, headers, "source_id") || `gs-task-${i}`,
          source_data: row.reduce((obj: any, val: string, idx: number) => {
            if (idx < headers.length) {
              obj[headers[idx]] = val;
            }
            return obj;
          }, {})
        };
        
        // Filter by project ID if provided
        if (!projectId || task.project_id === projectId) {
          tasks.push(task);
        }
      }
      
      return { data: tasks, raw: data };
    } catch (error) {
      console.error("Error fetching tasks from Google Sheets:", error);
      return { 
        data: [] as CanonicalTask[], 
        raw: { error: error instanceof Error ? error.message : 'Unknown error occurred' } 
      };
    }
  }
  
  /**
   * Helper method to get a value from a row by header name
   * @param row Row data array
   * @param headers Header names array
   * @param headerName Name of the header to find
   * @returns Value from the row or empty string if not found
   */
  private getValueByHeader(row: any[], headers: string[], headerName: string): string {
    const index = headers.findIndex(h => h.toLowerCase() === headerName.toLowerCase());
    return index !== -1 && index < row.length ? row[index] : "";
  }
  
  /**
   * Helper method to fetch data from Google Sheets API
   * @param spreadsheetId ID of the spreadsheet
   * @param range Range of cells to fetch
   * @returns Promise with the response data
   */
  private async getSheetData(spreadsheetId: string, range: string): Promise<any> {
    try {
      const apiKey = this.config.api_key;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching data from Google Sheets:", error);
      throw error;
    }
  }
}
