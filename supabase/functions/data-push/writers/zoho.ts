
interface ZohoCredentials {
  api_key: string;
  api_secret?: string;
  account_id?: string;
}

interface ZohoIntegration {
  id: string;
  provider_name: string;
  api_call_json: any;
}

interface WriteRequest {
  companyId: string;
  resourceType: string;
  resourceId?: string;
  data: Record<string, any>;
  operationType: 'write' | 'update' | 'delete';
}

export class ZohoWriter {
  private integration: ZohoIntegration;
  private credentials: ZohoCredentials;
  private authToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(integration: ZohoIntegration, credentials: ZohoCredentials) {
    this.integration = integration;
    this.credentials = credentials;
  }

  async execute(request: WriteRequest): Promise<any> {
    // Ensure we have valid authentication
    await this.ensureAuthentication();
    
    // Handle append_note as a special case
    if (request.operationType === 'append_note' as any && request.resourceType === 'project') {
      return await this.handleAppendNoteOperation(request);
    }
    
    // Get the configuration for the resource type
    const config = this.getResourceConfig(request.resourceType, 'write');
    
    if (!config) {
      throw new Error(`No configuration found for writing ${request.resourceType}`);
    }
    
    // Map our canonical fields to Zoho fields
    const mappedData = this.mapFields(request.data, request.resourceType);
    
    // Determine the appropriate endpoint and method
    const { endpoint, method } = this.getEndpointInfo(request, config);
    
    // Make the API call
    return await this.makeZohoRequest(endpoint, method, mappedData);
  }

  /**
   * Handles appending a note to a project's existing notes field in Zoho
   * Reads current notes, appends new content, then updates
   */
  private async handleAppendNoteOperation(request: WriteRequest): Promise<any> {
    const projectCrmId = request.resourceId;
    const noteContent = request.data.note_content;
    
    console.log(`Appending note to Zoho project ${projectCrmId}`);
    
    try {
      // Get API configuration
      const apiConfig = this.integration.api_call_json || {};
      const baseUrl = apiConfig.base_url || "www.zohoapis.com";
      const accountOwnerName = apiConfig.account_owner_name;
      const appLinkName = apiConfig.app_link_name;
      const reportLinkName = apiConfig.report_link_name || "All_Bids";
      
      // First, fetch the current project to get existing notes
      const getEndpoint = `https://${baseUrl}/creator/v2.1/data/${accountOwnerName}/${appLinkName}/report/${reportLinkName}/${projectCrmId}`;
      const currentProject = await this.makeZohoRequest(getEndpoint, 'GET', null);
      
      // Get existing notes (field name configured in api_call_json or defaults)
      const notesFieldName = apiConfig.notes_field || 'Notes' || 'Description';
      const existingNotes = currentProject?.data?.[notesFieldName] || '';
      
      // Append new note with separator
      const separator = existingNotes ? '\n\n---\n\n' : '';
      const updatedNotes = existingNotes + separator + noteContent;
      
      // Prepare update payload with the notes field
      const updatePayload = {
        data: {
          [notesFieldName]: updatedNotes
        }
      };
      
      // Update the project with appended notes
      const updateEndpoint = `https://${baseUrl}/creator/v2.1/data/${accountOwnerName}/${appLinkName}/report/${reportLinkName}/${projectCrmId}`;
      console.log(`Updating Zoho project ${projectCrmId} with appended note`);
      const result = await this.makeZohoRequest(updateEndpoint, 'PATCH', updatePayload);
      
      return {
        success: true,
        message: 'Note appended successfully',
        project_id: projectCrmId,
        result
      };
    } catch (error) {
      console.error(`Error appending note to Zoho project ${projectCrmId}:`, error);
      throw error;
    }
  }

  private getResourceConfig(resourceType: string, operationType: 'read' | 'write'): any {
    // Check if api_call_json is properly structured
    const apiConfig = this.integration.api_call_json || {};
    
    // Get the configuration for this operation type
    const typeConfig = apiConfig[operationType] || {};
    
    // Return resource-specific config or null if not found
    switch (resourceType) {
      case 'project':
        return typeConfig.project || null;
      case 'task':
        return typeConfig.task || null;
      case 'note':
        return typeConfig.note || null;
      case 'contact':
        return typeConfig.contact || null;
      default:
        return null;
    }
  }

  private getEndpointInfo(request: WriteRequest, config: any): { endpoint: string; method: string } {
    // Default values
    let endpoint = '';
    let method = 'POST';
    
    // Set endpoint based on resource type and operation
    switch (request.resourceType) {
      case 'project':
        if (request.operationType === 'update' && request.resourceId) {
          endpoint = config.update_endpoint || '';
          endpoint = endpoint.replace('{id}', request.resourceId);
          method = 'PUT';
        } else {
          endpoint = config.create_endpoint || '';
          method = 'POST';
        }
        break;
        
      case 'task':
        if (request.operationType === 'update' && request.resourceId) {
          endpoint = config.update_endpoint || '';
          endpoint = endpoint.replace('{id}', request.resourceId);
          method = 'PUT';
        } else {
          endpoint = config.create_endpoint || '';
          method = 'POST';
        }
        break;
        
      case 'note':
        endpoint = config.create_endpoint || '';
        method = 'POST';
        break;
        
      case 'contact':
        if (request.operationType === 'update' && request.resourceId) {
          endpoint = config.update_endpoint || '';
          endpoint = endpoint.replace('{id}', request.resourceId);
          method = 'PUT';
        } else {
          endpoint = config.create_endpoint || '';
          method = 'POST';
        }
        break;
    }
    
    // For delete operations, override method
    if (request.operationType === 'delete') {
      endpoint = config.delete_endpoint || '';
      endpoint = endpoint.replace('{id}', request.resourceId || '');
      method = 'DELETE';
    }
    
    return { endpoint, method };
  }

  private mapFields(data: Record<string, any>, resourceType: string): Record<string, any> {
    // Get field mappings from config
    const apiConfig = this.integration.api_call_json || {};
    const writeConfig = apiConfig.write || {};
    const mappings = writeConfig.field_mappings || {};
    
    // Apply resource-specific mappings
    const resourceMappings = mappings[resourceType] || {};
    
    // Map fields
    const result: Record<string, any> = {};
    for (const [ourField, value] of Object.entries(data)) {
      // Use mapping if available, otherwise use the original field name
      const zohoField = resourceMappings[ourField] || ourField;
      result[zohoField] = value;
    }
    
    return result;
  }

  private async ensureAuthentication(): Promise<void> {
    const now = Date.now();
    
    // If token is still valid, don't refresh
    if (this.authToken && now < this.tokenExpiry) {
      return;
    }
    
    // Get authentication config
    const authConfig = this.integration.api_call_json?.auth || {};
    const refreshTokenEndpoint = authConfig.refresh_token_endpoint;
    
    if (!refreshTokenEndpoint) {
      throw new Error("Missing refresh token endpoint in configuration");
    }
    
    try {
      // Make refresh token request
      const response = await fetch(refreshTokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.credentials.api_key,
          client_secret: this.credentials.api_secret || '',
          refresh_token: authConfig.refresh_token || '',
          grant_type: 'refresh_token'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
      }
      
      const tokenData = await response.json();
      this.authToken = tokenData.access_token;
      
      // Set expiry time (typically 1 hour, subtract 5 minutes for safety)
      this.tokenExpiry = now + ((tokenData.expires_in || 3600) - 300) * 1000;
      
    } catch (error) {
      console.error("Authentication error:", error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  private async makeZohoRequest(endpoint: string, method: string, data: any): Promise<any> {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      };
      
      // Add body for non-GET requests
      if (method !== 'GET' && data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(endpoint, options);
      
      if (!response.ok) {
        throw new Error(`Zoho API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Zoho API request error:", error);
      throw error;
    }
  }
}
