
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./utils/headers.ts";

interface IntegrationData {
  company_id: string;
  provider_type: 'email' | 'phone' | 'crm';
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

    const body = await req.json();
    const url = new URL(req.url);
    
    // Add new integration
    if (req.method === 'POST' && url.pathname.endsWith('manage-integrations') && body.company_id) {
      // Validate required fields
      if (!body.company_id || !body.provider_type || 
          !body.provider_name || !body.api_key) {
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
        .insert(body)
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
    } 
    // Delete integration
    else if (req.method === 'POST' && body.integrationId) {      
      if (!body.integrationId) {
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
        .eq('id', body.integrationId);
        
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
    } 
    // Toggle integration status
    else if (req.method === 'POST' && body.integrationId !== undefined && body.isActive !== undefined) {      
      if (body.integrationId === undefined || body.isActive === undefined) {
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
        .update({ is_active: !body.isActive })
        .eq('id', body.integrationId);
        
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
    } 
    // Update default provider
    else if (req.method === 'POST' && body.companyId && body.type) {      
      if (!body.companyId || !body.type) {
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
      
      let updateField;
      switch(body.type) {
        case 'email':
          updateField = 'default_email_provider'; 
          break;
        case 'phone':
          updateField = 'default_phone_provider'; 
          break;
        case 'crm':
          updateField = 'default_crm_provider'; 
          break;
        default:
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Invalid provider type. Must be "email", "phone", or "crm".'
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
      }
      
      const updates = { [updateField]: body.providerId };
        
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', body.companyId);
        
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
