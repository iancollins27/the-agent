
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../utils/cors.ts'
import { processWebhookRequest, createErrorResponse, createSuccessResponse } from '../services/webhookIntake.ts'
import { normalizeWebhookData } from '../services/normalizer.ts'
import { processWebhookBusinessLogic } from '../services/businessLogic.ts'
import { generateWorkflowPrompt, runWorkflowPrompt } from '../services/workflowPrompt.ts'
import { detectAndProcessActions } from '../services/actionDetection.ts'

/**
 * Main handler for processing the Zoho webhook
 * @param req Request object
 * @returns Response object
 */
export async function handleZohoWebhook(req: Request) {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Step 1: Process the webhook request
    let webhookData;
    try {
      webhookData = await processWebhookRequest(req);
    } catch (error) {
      console.error('Error processing webhook request:', error);
      return createErrorResponse(error.message, 400);
    }

    // Step 2: Normalize the webhook data
    let normalizedData, projectData;
    try {
      const result = await normalizeWebhookData(webhookData.source, webhookData.payload);
      normalizedData = result.standardizedData;
      projectData = result.projectData;
    } catch (error) {
      console.error('Error normalizing webhook data:', error);
      return createErrorResponse(`Failed to normalize data: ${error.message}`, 422);
    }

    // Step 3: Process business logic
    let businessLogicResult;
    try {
      businessLogicResult = await processWebhookBusinessLogic(supabase, projectData, normalizedData);
    } catch (error) {
      console.error('Error processing business logic:', error);
      return createErrorResponse(`Business logic error: ${error.message}`, 500);
    }

    // Step 4: Generate a workflow prompt
    let workflowResult;
    try {
      // Generate the workflow prompt
      const promptResult = await generateWorkflowPrompt(
        supabase,
        businessLogicResult.projectId,
        projectData,
        businessLogicResult
      );
      
      // Run the workflow prompt through the AI
      workflowResult = await runWorkflowPrompt(
        supabase,
        businessLogicResult.projectId,
        promptResult.summary || '',
        businessLogicResult.aiProvider || 'openai',
        businessLogicResult.aiModel || 'gpt-4o'
      );
      
      // Update the summary in our business logic result
      businessLogicResult.summary = workflowResult.summary;
    } catch (error) {
      console.error('Error generating workflow prompt:', error);
      return createErrorResponse(`Workflow prompt error: ${error.message}`, 500);
    }

    // Step 5: Run action detection and execution
    let actionResult = {};
    try {
      actionResult = await detectAndProcessActions(
        supabase,
        businessLogicResult.projectId,
        workflowResult.summary,
        businessLogicResult,
        projectData
      );
    } catch (error) {
      console.error('Error detecting actions:', error);
      // We don't want to fail the webhook if action detection fails
      // Just log the error and continue
    }

    // Return success response with all the data
    return createSuccessResponse({ 
      success: true, 
      summary: workflowResult.summary, 
      isNewProject: businessLogicResult.isNewProject,
      parsedData: projectData,
      nextStepInstructions: businessLogicResult.nextStepInstructions,
      companyUuid: businessLogicResult.companyUuid,
      projectTrackId: businessLogicResult.projectTrackId,
      aiProvider: businessLogicResult.aiProvider,
      aiModel: businessLogicResult.aiModel,
      projectId: businessLogicResult.projectId,
      actionResult
    });
  } catch (error) {
    console.error('Unhandled error:', error);
    return createErrorResponse(error.message, 500);
  }
}
