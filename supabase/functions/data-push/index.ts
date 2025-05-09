
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ZohoWriter } from "./writers/zoho.ts";

// CORS headers for browser support
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DataPushRequest {
  companyId: string;
  resourceType: string;
  resourceId?: string;
  data: Record<string, any>;
  operationType: 'write' | 'update' | 'delete';
  jobId?: string;
}

class DataWriteRouter {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async route(request: DataPushRequest): Promise<any> {
    try {
      // Get company integration details
      const { data: integration, error: integrationError } = await this.supabase
        .from("company_integrations")
        .select("*")
        .eq("company_id", request.companyId)
        .eq("provider_type", "crm")
        .eq("is_active", true)
        .single();

      if (integrationError || !integration) {
        throw new Error(`No active CRM integration found for company: ${integrationError?.message || "Unknown error"}`);
      }

      // Log access to the key
      await this.supabase.rpc('log_integration_key_access', {
        p_integration_id: integration.id,
        p_accessed_by: 'data-push-function',
        p_access_reason: `${request.operationType} operation for ${request.resourceType}`,
        p_source_ip: 'internal-function'
      });

      // Get secure credentials if needed
      const { data: credentials, error: credentialsError } = await this.supabase.rpc(
        'get_company_integration_keys',
        { integration_id: integration.id }
      );
      
      if (credentialsError) {
        throw new Error(`Failed to retrieve integration credentials: ${credentialsError.message}`);
      }

      // Create writer based on provider
      let writer;
      switch (integration.provider_name.toLowerCase()) {
        case "zoho":
          writer = new ZohoWriter(integration, credentials);
          break;
        default:
          throw new Error(`Unsupported CRM provider: ${integration.provider_name}`);
      }

      // Execute the write operation
      const result = await writer.execute(request);
      
      // If we have a jobId, update the job status
      if (request.jobId) {
        await this.updateJobStatus(request.jobId, "completed", result);
      }
      
      return result;
    } catch (error) {
      console.error("Data push error:", error);
      
      // If we have a jobId, update the job status with the error
      if (request.jobId) {
        await this.updateJobStatus(request.jobId, "failed", null, error.message);
      }
      
      throw error;
    }
  }

  async updateJobStatus(
    jobId: string, 
    status: string, 
    result: any = null, 
    errorMessage: string | null = null
  ): Promise<void> {
    const updates: any = {
      status,
      processed_at: new Date().toISOString()
    };

    if (result) {
      updates.result = result;
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    await this.supabase
      .from("integration_job_queue")
      .update(updates)
      .eq("id", jobId);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables for Supabase connection");
    }

    // Parse the request body
    const requestData: DataPushRequest = await req.json();
    const router = new DataWriteRouter(supabaseUrl, supabaseKey);
    const result = await router.route(requestData);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in data-push function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
