import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleRequest } from './handlers/handleRequest.ts';
import { corsHeaders } from './utils/cors.ts';

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

console.log("Starting test-workflow-prompt function, connecting to Supabase at:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Add better logging for MCP usage
function logWithTime(message: string) {
  const now = new Date();
  const timeString = now.toISOString();
  console.log(`[${timeString}] ${message}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    logWithTime('Starting test-workflow-prompt function, connecting to Supabase at: ' + 
      Deno.env.get('SUPABASE_URL')?.substring(0, 30) + '...');
    
    const response = await handleRequest(req);
    logWithTime('Successfully processed request, returning response');
    
    return response;
  } catch (error) {
    logWithTime(`Error processing request: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
