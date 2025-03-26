
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, initSupabaseClient } from './utils.ts';
import { parseWebhookPayload } from './parser.ts';
import { getProjectByCrmId, processContact } from './contactService.ts';
import { WebhookPayload, ProcessResult } from './types.ts';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = initSupabaseClient();

    // Log request method and URL for debugging
    console.log(`Request method: ${req.method}, URL: ${req.url}`);
    
    // Parse webhook payload
    const payload: WebhookPayload = await parseWebhookPayload(req);
    console.log('Parsed webhook payload:', payload);
    
    // Validate the payload
    if (!payload.contacts || !Array.isArray(payload.contacts) || !payload.Bid_ID) {
      const error = 'Invalid webhook payload: missing contacts array or Bid_ID';
      console.error(error, payload);
      throw new Error(error);
    }

    // Ensure Bid_ID is treated as a string
    const bidId = String(payload.Bid_ID);
    console.log(`Using Bid_ID (as string): "${bidId}"`);

    // Get the project by CRM ID (Bid_ID)
    const project = await getProjectByCrmId(supabase, bidId);

    // Process each contact
    const results = await Promise.all(
      payload.contacts.map(contact => processContact(supabase, contact, project.id))
    );

    // Prepare the response
    const response: ProcessResult = {
      success: true,
      message: `Processed ${results.filter(r => r.status === 'success').length} of ${payload.contacts.length} contacts`,
      projectId: project.id,
      results
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error processing contacts webhook:', error);
    
    const errorResponse: ProcessResult = {
      success: false,
      message: 'Error processing contacts webhook',
      error: error.message
    };

    return new Response(
      JSON.stringify(errorResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
