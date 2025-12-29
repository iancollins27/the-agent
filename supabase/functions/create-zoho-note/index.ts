// @ts-ignore: Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZohoCredentials {
  refresh_token: string;
  client_secret?: string;
  client_id?: string;
  api_key?: string;
  api_secret?: string;
  account_id?: string;
  access_token?: string;
}

interface ZohoIntegration {
  id: string;
  provider_name: string;
  api_call_json: any;
}

interface RequestBody {
  projectId: string;
  message: string;
  actionId?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { projectId, message, actionId } = await req.json() as RequestBody;

    if (!projectId || !message) {
      return new Response(
        JSON.stringify({ error: 'Project ID and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Supabase client
    // @ts-ignore: Deno namespace
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    // @ts-ignore: Deno namespace
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Zoho credentials from the database
    const { data: integrationData, error: integrationError } = await supabase
      .from('company_integrations')
      .select('*')
      .eq('provider_name', 'zoho')
      .single();

    if (integrationError || !integrationData) {
      console.error('Error fetching Zoho integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Zoho integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All credentials are already in the integrationData
    // No need to fetch from a separate table
    const credentialsData = {
      refresh_token: integrationData.oauth_refresh_token,
      client_id: integrationData.api_key,
      client_secret: integrationData.api_secret
    };
    
    if (!credentialsData.refresh_token || !credentialsData.client_id || !credentialsData.client_secret) {
      console.error('Missing required Zoho credentials in company_integrations record');
      return new Response(
        JSON.stringify({ error: 'Missing required Zoho credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the Zoho integration and credentials objects
    const integration: ZohoIntegration = {
      id: integrationData.id,
      provider_name: integrationData.provider_name,
      api_call_json: integrationData.api_call_json
    };

    const credentials: ZohoCredentials = {
      api_key: credentialsData.refresh_token,
      api_secret: credentialsData.client_secret,
      account_id: credentialsData.client_id,
      refresh_token: credentialsData.refresh_token,
      client_id: credentialsData.client_id,
      client_secret: credentialsData.client_secret
    };

    // Create a ZohoWriter instance
    class ZohoWriter {
      private integration: ZohoIntegration;
      private credentials: ZohoCredentials;
      private accessToken: string | null = null;
      private tokenExpiry: number = 0;

      constructor(integration: ZohoIntegration, credentials: ZohoCredentials) {
        this.integration = integration;
        this.credentials = credentials;
      }

      private async authenticate(): Promise<string | null> {
        console.log('Authenticating with Zoho...');
        
        if (this.accessToken && Date.now() < this.tokenExpiry) {
          return this.accessToken;
        }

        const refreshToken = this.credentials.refresh_token;
        const clientId = this.credentials.client_id;
        const clientSecret = this.credentials.client_secret;

        console.log(`Authentication parameters: refreshToken=${refreshToken ? 'provided' : 'missing'}, clientId=${clientId ? 'provided' : 'missing'}, clientSecret=${clientSecret ? 'provided' : 'missing'}`);

        const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
        const params = new URLSearchParams({
          refresh_token: refreshToken || '',
          client_id: clientId || '',
          client_secret: clientSecret || '',
          grant_type: 'refresh_token'
        });

        console.log(`Token request URL: ${tokenUrl}`);
        console.log(`Token request params: ${params.toString()}`);

        try {
          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
          });

          // First get the response as text to handle potential non-JSON responses
          const responseText = await response.text();
          console.log(`Token refresh response text: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
          
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            throw new Error(`Invalid response from Zoho authentication endpoint: ${responseText.substring(0, 100)}...`);
          }
          
          if (!response.ok) {
            console.error('Authentication error:', data);
            throw new Error(`Zoho authentication failed: ${JSON.stringify(data)}`);
          }

          this.accessToken = data.access_token;
          // Set token expiry (typically 1 hour)
          this.tokenExpiry = Date.now() + (data.expires_in * 1000);
          
          console.log('Authentication successful, token received');
          return this.accessToken;
        } catch (error) {
          console.error('Error authenticating with Zoho:', error);
          throw new Error(`Failed to authenticate with Zoho: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      public async createNote(projectId: string, message: string, createdById: string = '4081527000016945693'): Promise<any> {
        try {
          // Use the authenticated token to create a note in Zoho
          const token = await this.authenticate();
          
          if (!token) {
            throw new Error('Failed to obtain authentication token');
          }
          
          // Get API configuration from integration
          const apiConfig = this.integration.api_call_json;
          if (!apiConfig) {
            throw new Error('API configuration not found in integration');
          }

          // Extract endpoint and field mappings or use hardcoded values
          let endpoint = apiConfig?.write?.note?.create_endpoint;
          if (!endpoint) {
            // Use hardcoded endpoint as fallback
            console.log('Note creation endpoint not found in integration configuration, using default endpoint');
            // The correct format for Zoho Creator API v2.1 is:
            // https://creator.zoho.com/api/v2.1/{account_owner_name}/{app_link_name}/form/{form_link_name}
            endpoint = 'https://creator.zoho.com/api/v2.1/bidlist/marketplace/form/Activities';
          }
          
          // Use default field mappings if not provided in configuration
          const fieldMappings = apiConfig?.write?.field_mappings?.note || {};

          // Map fields according to configuration with fallbacks
          const noteField = fieldMappings.message || 'Note';
          const bidField = fieldMappings.project_id || 'Bid';
          const createdByField = fieldMappings.created_by || 'Created_By';
          
          console.log(`Using field mappings: noteField=${noteField}, bidField=${bidField}, createdByField=${createdByField}`);
          
          // Create the payload
          const data: Record<string, any> = {};
          data[noteField] = message;
          
          // Fetch the crm_id from the projects table for the given projectId
          console.log(`Fetching crm_id from projects table for projectId: ${projectId}`);
          
          try {
            // Query the projects table to get the crm_id
            const { data: projectData, error: projectError } = await supabase
              .from('projects')
              .select('crm_id')
              .eq('id', projectId)
              .single();
              
            if (projectError || !projectData) {
              console.error('Error fetching project crm_id:', projectError);
              throw new Error(`Failed to fetch crm_id for project ${projectId}`);
            }
            
            if (!projectData.crm_id) {
              console.error('Project has no crm_id:', projectId);
              throw new Error(`Project ${projectId} has no crm_id in the database`);
            }
            
            console.log(`Found crm_id for project: ${projectData.crm_id}`);
            data[bidField] = projectData.crm_id;
          } catch (error) {
            console.error('Error processing projectId:', error);
            // Fallback to using the projectId as-is, though this will likely fail
            data[bidField] = projectId;
          }
          
          data[createdByField] = createdById;
          
          console.log(`Creating note with payload: ${JSON.stringify(data)}`);
          console.log(`Using endpoint: ${endpoint}`);

          // For Zoho Creator API v2.1, the data needs to be properly formatted
          const requestBody = { data };
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Zoho-oauthtoken ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          // Get response as text first to handle potential non-JSON responses
          const responseText = await response.text();
          console.log(`Note creation response text: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
          
          let result;
          try {
            result = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            throw new Error(`Invalid response from Zoho note creation endpoint: ${responseText.substring(0, 100)}...`);
          }
          
          if (!response.ok) {
            console.error('Error creating note:', result);
            throw new Error(`Failed to create note: ${JSON.stringify(result)}`);
          }
          
          console.log('Note created successfully:', result);
          return result;
        } catch (error) {
          console.error('Error in createNote:', error);
          throw error;
        }
      }
    }

    const zohoWriter = new ZohoWriter(integration, credentials);

    // Create a note in Zoho
    // Use the BidList Bot user ID for Created_By
    // Always use the specific Zoho user ID 4081527000016945693 for Created_By
    const result = await zohoWriter.createNote(projectId, message, '4081527000016945693');

    // If an actionId was provided, update the action record
    if (actionId) {
      await supabase
        .from('action_records')
        .update({
          execution_result: { zoho_note_created: true, zoho_response: result },
        })
        .eq('id', actionId);
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error creating Zoho note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
