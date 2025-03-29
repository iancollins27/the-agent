
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../send-communication/utils/headers.ts";

interface IntegrationData {
  company_id: string;
  provider_type: 'email' | 'phone';
  provider_name: string;
  api_key: string;
  api_secret?: string | null;
  account_id?: string | null;
  is_active: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    if (req.method === 'POST' && path === 'add') {
      // Add new integration
      const requestData = await req.json();

      // Validate required fields
      if (!requestData.company_id || !requestData.provider_type || 
          !requestData.provider_name || !requestData.api_key) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Missing required fields' 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Insert the integration with service role (bypassing RLS)
      const { data, error } = await supabase
        .from('company_integrations')
        .insert(requestData)
        .select();

      if (error) {
        console.error('Error adding integration:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else if (req.method === 'POST' && path === 'delete') {
      // Delete integration
      const { integrationId } = await req.json();
      
      if (!integrationId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Integration ID is required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const { error } = await supabase
        .from('company_integrations')
        .delete()
        .eq('id', integrationId);
        
      if (error) {
        console.error('Error deleting integration:', error);
        throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else if (req.method === 'POST' && path === 'toggle-status') {
      // Toggle integration status
      const { integrationId, isActive } = await req.json();
      
      if (integrationId === undefined || isActive === undefined) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Integration ID and status are required' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const { error } = await supabase
        .from('company_integrations')
        .update({ is_active: !isActive })
        .eq('id', integrationId);
        
      if (error) {
        console.error('Error updating integration status:', error);
        throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else if (req.method === 'POST' && path === 'update-default') {
      // Update default provider
      const { companyId, type, providerId } = await req.json();
      
      if (!companyId || !type) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Company ID and provider type are required' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const updates = type === 'email' 
        ? { default_email_provider: providerId } 
        : { default_phone_provider: providerId };
        
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', companyId);
        
      if (error) {
        console.error('Error updating default provider:', error);
        throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If no valid path is matched
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error(`Error in manage-integrations function:`, error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
