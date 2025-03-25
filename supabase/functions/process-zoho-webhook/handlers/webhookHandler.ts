
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseZohoData } from '../parser.ts';
import { corsHeaders } from '../utils/cors.ts';
import { processProject } from '../services/projectService.ts';

/**
 * Main handler for processing the Zoho webhook
 * @param req Request object
 * @returns Response object
 */
export async function handleZohoWebhook(req: Request) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log the raw request body for debugging
    const requestBody = await req.json();
    console.log('Raw webhook payload:', requestBody);
    
    // Handle both cases where data might be nested or not
    const rawData = requestBody.rawData || requestBody;
    const projectData = await parseZohoData(rawData);
    console.log('Parsed project data:', projectData);

    // Process the project data
    const result = await processProject(supabase, projectData, rawData);

    // Return the response
    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: result.summary, 
        isNewProject: result.isNewProject,
        parsedData: projectData,
        nextStepInstructions: result.nextStepInstructions,
        companyUuid: result.companyUuid,
        projectTrackId: result.projectTrackId,
        aiProvider: result.aiProvider,
        aiModel: result.aiModel,
        projectId: result.projectId,
        projectManagerId: result.projectManagerId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}
