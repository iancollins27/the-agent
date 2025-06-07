
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestConnectionRequest {
  companyId: string;
  testJobId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables for Supabase connection");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { companyId, testJobId }: TestConnectionRequest = await req.json();

    console.log(`Testing JobProgress connection for company: ${companyId}`);

    // Get company integration details
    const { data: integration, error: integrationError } = await supabase
      .from("company_integrations")
      .select("*")
      .eq("company_id", companyId)
      .eq("provider_name", "JobProgress")
      .eq("is_active", true)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `No active JobProgress integration found: ${integrationError?.message || "Not found"}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Test basic API connection with a simple endpoint
    const testResponse = await fetch('https://api.jobprogress.com/api/v3/customers?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `JobProgress API error: ${testResponse.status} ${testResponse.statusText}`,
          details: errorText
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const customersData = await testResponse.json();
    
    let jobTestResult = null;
    
    // If a specific job ID was provided, test fetching that job
    if (testJobId) {
      console.log(`Testing specific job fetch: ${testJobId}`);
      
      const jobResponse = await fetch(`https://api.jobprogress.com/api/v3/jobs/${testJobId}?includes[]=address&includes[]=customer`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${integration.api_key}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (jobResponse.ok) {
        jobTestResult = {
          success: true,
          data: await jobResponse.json()
        };
      } else {
        jobTestResult = {
          success: false,
          error: `Job fetch failed: ${jobResponse.status} ${jobResponse.statusText}`,
          details: await jobResponse.text()
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "JobProgress connection successful",
        integration: {
          provider_name: integration.provider_name,
          account_id: integration.account_id,
          created_at: integration.created_at
        },
        apiTest: {
          endpoint: "customers",
          status: testResponse.status,
          sampleData: customersData
        },
        jobTest: jobTestResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Error testing JobProgress connection:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
