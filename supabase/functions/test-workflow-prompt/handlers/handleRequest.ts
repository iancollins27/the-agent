
import { corsHeaders } from '../utils/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseRequestBody } from '../middleware/requestParser.ts';
import { loadMilestoneInstructions } from '../middleware/milestoneLoader.ts';
import { runPrompt } from '../middleware/promptRunner.ts';
import { formatResponse, handleError } from '../middleware/responseFormatter.ts';

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Main handler for the test-workflow-prompt edge function
 * Refactored to use middleware pattern for better organization
 */
export async function handleRequest(req: Request) {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    // Parse and validate request body
    const { body, error } = await parseRequestBody(req);
    if (error) return error;

    // Ensure we have context data
    const contextData = body.contextData || {};
    
    // Load milestone instructions if needed
    if (contextData.next_step && !contextData.milestone_instructions) {
      contextData.milestone_instructions = await loadMilestoneInstructions(supabaseClient, contextData);
    }
    
    // Run the prompt and process the AI response
    const result = await runPrompt(supabaseClient, { ...body, contextData });
    
    // Format and return the response
    return formatResponse(result);
  } catch (error) {
    return handleError(error);
  }
}
