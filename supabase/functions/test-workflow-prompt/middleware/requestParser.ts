
import { corsHeaders } from '../utils/cors.ts';
import { prepareContextData } from '../database/utils/contextUtils.ts';
import { getProjectContacts, formatContactsForContext } from '../database/contacts.ts';

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
      
      console.log(`[DEBUG] Request parser: Starting project context preparation for project ${body.projectId}`);
      
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.38.4');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // First try direct contacts fetch for debugging
      console.log(`[DEBUG] Request parser: Direct contacts fetch attempt for project ${body.projectId}`);
      const contacts = await getProjectContacts(supabase, body.projectId);
      console.log(`[DEBUG] Request parser: Direct fetch returned ${contacts?.length || 0} contacts`);
      
      if (contacts && contacts.length > 0) {
        console.log(`[DEBUG] Request parser: First contact: ${JSON.stringify(contacts[0])}`);
        const formattedContacts = formatContactsForContext(contacts);
        console.log(`[DEBUG] Request parser: Formatted contacts result: ${formattedContacts ? 'has content' : 'empty'}`);
        console.log(`[DEBUG] Request parser: First 150 chars of formatted contacts: ${formattedContacts.substring(0, 150)}...`);
      } else {
        console.log(`[DEBUG] Request parser: No contacts found in direct fetch`);
      }
      
      // Now use the prepareContextData function
      console.log(`[DEBUG] Request parser: Calling prepareContextData for project ${body.projectId}`);
      const { contextData } = await prepareContextData(supabase, body.projectId);
      
      // Check if project_contacts was properly set
      console.log(`[DEBUG] Request parser: After prepareContextData, project_contacts exists: ${!!contextData.project_contacts}`);
      if (contextData.project_contacts) {
        console.log(`[DEBUG] Request parser: First 150 chars of project_contacts: ${contextData.project_contacts.substring(0, 150)}...`);
      }
      
      // Merge the prepared context data with any existing contextData in the request
      body.contextData = { ...(body.contextData || {}), ...contextData };
      
      // Double-check that project_contacts made it into the final merged contextData
      console.log(`[DEBUG] Request parser: After merging, body.contextData.project_contacts exists: ${!!body.contextData.project_contacts}`);
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
