
import { corsHeaders } from '../utils/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseRequestBody } from '../middleware/requestParser.ts';
import { loadMilestoneInstructions } from '../middleware/milestoneLoader.ts';
import { runPrompt } from '../middleware/promptRunner.ts';
import { formatResponse, handleError } from '../middleware/responseFormatter.ts';
import { prepareContextData } from '../database/utils/contextUtils.ts';
import { getProjectContacts, formatContactsForContext } from '../database/contacts.ts';

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
    console.log(`[DEBUG] HandleRequest: Starting request handling`);
    
    // Parse and validate request body
    const { body, error } = await parseRequestBody(req);
    if (error) return error;

    // Ensure we have context data
    const contextData = body.contextData || {};
    console.log(`[DEBUG] HandleRequest: After parseRequestBody, context keys: ${Object.keys(contextData).join(', ')}`);
    console.log(`[DEBUG] HandleRequest: After parseRequestBody, project_contacts exists: ${!!contextData.project_contacts}`);
    
    // If we have a projectId but no project_contacts, fetch them explicitly
    if (body.projectId && !contextData.project_contacts) {
      try {
        console.log(`[DEBUG] HandleRequest: Explicitly fetching contacts for project: ${body.projectId}`);
        
        // Approach 1: Direct fetch
        console.log(`[DEBUG] HandleRequest: Approach 1 - Direct fetch using getProjectContacts`);
        const contacts = await getProjectContacts(supabaseClient, body.projectId);
        console.log(`[DEBUG] HandleRequest: Direct fetch returned ${contacts?.length || 0} contacts`);
        
        if (contacts && contacts.length > 0) {
          const formattedContacts = formatContactsForContext(contacts);
          console.log(`[DEBUG] HandleRequest: Formatted ${contacts.length} contacts: ${formattedContacts?.substring(0, 100)}...`);
          contextData.project_contacts = formattedContacts;
        }
        
        // Approach 2: Use prepareContextData
        console.log(`[DEBUG] HandleRequest: Approach 2 - Using prepareContextData`);
        const { contextData: enhancedContext } = await prepareContextData(supabaseClient, body.projectId);
        
        // Log what we got from prepareContextData
        console.log(`[DEBUG] HandleRequest: prepareContextData returned project_contacts: ${!!enhancedContext.project_contacts}`);
        
        // Merge the context data to ensure we have project_contacts
        Object.assign(contextData, enhancedContext);
        console.log(`[DEBUG] HandleRequest: After merging, project_contacts exists: ${!!contextData.project_contacts}`);
        
        if (contextData.project_contacts) {
          console.log(`[DEBUG] HandleRequest: Final project_contacts (first 100 chars): ${contextData.project_contacts.substring(0, 100)}...`);
        } else {
          console.log(`[DEBUG] HandleRequest: Failed to get project_contacts from either approach`);
        }
      } catch (contactError) {
        console.error("[DEBUG] HandleRequest: Error explicitly fetching project contacts:", contactError);
      }
    }
    
    // Load milestone instructions if needed
    if (contextData.next_step && !contextData.milestone_instructions) {
      contextData.milestone_instructions = await loadMilestoneInstructions(supabaseClient, contextData);
    }
    
    // Log contextData keys right before running the prompt
    console.log(`[DEBUG] HandleRequest: Final contextData keys: ${Object.keys(contextData).join(', ')}`);
    console.log(`[DEBUG] HandleRequest: project_contacts exists in final data: ${!!contextData.project_contacts}`);
    
    // Run the prompt and process the AI response
    const result = await runPrompt(supabaseClient, { ...body, contextData });
    
    // Format and return the response
    return formatResponse(result);
  } catch (error) {
    return handleError(error);
  }
}
