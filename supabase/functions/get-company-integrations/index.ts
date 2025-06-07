
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const providerName = url.searchParams.get('provider');

    if (!providerName) {
      return new Response(
        JSON.stringify({ error: 'Provider name is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Fetching ${providerName} company integrations...`);

    // Fetch company integrations with service role (bypasses RLS)
    const { data, error } = await supabase
      .from('company_integrations')
      .select(`
        id,
        company_id,
        provider_name,
        is_active,
        companies!company_integrations_company_id_fkey (
          id,
          name
        )
      `)
      .eq('provider_name', providerName)
      .eq('is_active', true);

    console.log(`${providerName} integrations query result:`, { data, error });

    if (error) {
      console.error(`Error fetching ${providerName} integrations:`, error);
      throw error;
    }

    return new Response(
      JSON.stringify({ data }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in get-company-integrations function:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
