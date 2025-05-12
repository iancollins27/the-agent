
import { corsHeaders } from '../utils/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseRequestBody } from '../middleware/requestParser.ts';
import { loadMilestoneInstructions } from '../middleware/milestoneLoader.ts';
import { runPrompt } from '../middleware/promptRunner.ts';
import { formatResponse, handleError } from '../middleware/responseFormatter.ts';
import { prepareContextData } from '../database/utils/contextUtils.ts';

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
    
    // If we have a projectId but no project_contacts, fetch them explicitly
    if (body.projectId && !contextData.project_contacts) {
      try {
        console.log(`Explicitly fetching contacts for project: ${body.projectId}`);
        const { contextData: enhancedContext } = await prepareContextData(supabaseClient, body.projectId);
        // Merge the context data to ensure we have project_contacts
        Object.assign(contextData, enhancedContext);
        console.log(`Successfully added project_contacts: ${contextData.project_contacts ? 'Yes' : 'No'}`);
      } catch (contactError) {
        console.error("Error explicitly fetching project contacts:", contactError);
      }
    }
    
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
