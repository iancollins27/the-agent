
import { corsHeaders } from '../utils/cors.ts';
import { prepareContextData } from '../database/utils/contextUtils.ts';

/**
 * Parse and validate the request body
 */
export async function parseRequestBody(req: Request): Promise<{
  body?: any;
  error?: Response;
}> {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return {
      error: new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    };
  }

  try {
    const body = await req.json();
    const requiredFields = ['promptType'];
    
    // Validate required fields
    for (const field of requiredFields) {
      if (!body[field]) {
        return {
          error: new Response(JSON.stringify({ error: `Missing required field: ${field}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        };
      }
    }
    
    // Add enhanced context data if projectId is provided
    if (body.projectId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.38.4');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { contextData } = await prepareContextData(supabase, body.projectId);
      
      // Merge the prepared context data with any existing contextData in the request
      body.contextData = { ...(body.contextData || {}), ...contextData };
      
      console.log(`Enhanced context data with project-specific information for project ${body.projectId}`);
      console.log(`Context data now includes project_contacts: ${!!body.contextData.project_contacts}`);
    }

    console.log(`Request validation passed for prompt type: ${body.promptType}`);
    return { body };
  } catch (error) {
    console.error('Error parsing request body:', error);
    return {
      error: new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    };
  }
}
