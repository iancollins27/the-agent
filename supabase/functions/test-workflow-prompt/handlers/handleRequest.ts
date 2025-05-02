
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../utils/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { logPromptRun } from '../database/prompt-runs.ts'; 
import { replaceVariables } from '../utils.ts';
import { handleAIResponse } from '../services/aiResponseHandler.ts';

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Main handler for the test-workflow-prompt edge function
 */
export async function handleRequest(req: Request) {
  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return new Response(JSON.stringify({
      error: 'Invalid request body'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }

  // Log request details
  console.log('Processing request through handleRequest');
  
  // Extract required parameters
  const {
    promptType,
    promptText,
    projectId,
    contextData = {},
    aiProvider = 'openai',
    aiModel = 'gpt-4o',
    workflowPromptId,
    useMCP = false,  // Flag to use MCP processing
    initiatedBy = 'manual'
  } = body;

  // Check for special prompt type handling
  const isMCPPrompt = promptType === 'mcp_orchestrator' || useMCP === true;
  
  // Log the request details
  console.log(`Testing prompt type: ${promptType} for project ${projectId}`);
  console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);
  console.log(`Using MCP: ${isMCPPrompt}`);
  console.log(`Initiated by: ${initiatedBy}`);

  // Enhanced milestone instructions handling
  let milestoneInstructions = null;
  
  // If the milestone instructions are not provided directly, try to fetch them
  if (contextData.next_step && !contextData.milestone_instructions) {
    try {
      const trackId = contextData.track_id;
      
      if (!trackId) {
        console.error('Missing track_id for milestone:', contextData.next_step);
        console.log('Missing projectTrackId parameter, cannot fetch milestone instructions for step:', contextData.next_step);
        milestoneInstructions = "No specific instructions available for this milestone step.";
      } else {
        // Fetch milestone instructions from the database
        const { data: milestone, error } = await supabaseClient
          .from('project_track_milestones')
          .select('prompt_instructions')
          .eq('track_id', trackId)
          .eq('step_title', contextData.next_step)
          .single();

        if (error || !milestone) {
          console.log(`No milestone instructions found for step "${contextData.next_step}" with track_id: ${trackId}`);
          milestoneInstructions = "No specific instructions available for this milestone step.";
        } else {
          console.log(`Found milestone with step title: ${contextData.next_step}`);
          milestoneInstructions = milestone.prompt_instructions;
          console.log(`Instructions preview: ${milestoneInstructions?.substring(0, 50)}...`);
        }
      }
    } catch (error) {
      console.error('Error fetching milestone instructions:', error);
      milestoneInstructions = "No specific instructions available for this milestone step.";
    }
    
    // Add the milestone instructions to the context data if we found any
    if (milestoneInstructions && !contextData.milestone_instructions) {
      contextData.milestone_instructions = milestoneInstructions;
    }
  }

  // Create a prompt run in the database
  let promptRunId;
  try {
    const inputLength = promptText?.length || 0;
    console.log(`Logging prompt run with data:`, {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptText?.substring(0, 100) + "...",
      ai_provider: aiProvider,
      ai_model: aiModel,
      input_length: inputLength
    });
    
    // Create or find an appropriate prompt run ID
    promptRunId = await logPromptRun(
      supabaseClient, 
      projectId, 
      workflowPromptId, 
      promptText,
      aiProvider,
      aiModel,
      initiatedBy
    );
    
    // Update project with latest prompt run ID
    if (projectId && promptRunId) {
      const { error } = await supabaseClient
        .from('projects')
        .update({ latest_prompt_run_ID: promptRunId })
        .eq('id', projectId);
      
      if (error) {
        console.error('Error updating project with latest_prompt_run_ID:', error);
      } else {
        console.log(`Successfully updated project ${projectId} with latest_prompt_run_ID: ${promptRunId}`);
      }
    }
  } catch (error) {
    console.error('Error logging prompt run:', error);
    // Continue execution even if logging fails
  }

  try {
    // Process the requested prompt
    let result;
    
    // Use variable replacement for all prompt types
    const finalPrompt = replaceVariables(promptText, contextData);
    console.log(`Final prompt after variable replacement: ${finalPrompt.substring(0, 100)}...`);
    
    // Choose processing method based on prompt type and MCP flag
    if (isMCPPrompt) {
      // Use MCP-based processing
      result = await handleAIResponse(
        supabaseClient,
        aiProvider,
        aiModel,
        finalPrompt,
        promptRunId,
        projectId,
        promptType,
        true, // Enable MCP
        contextData
      );
    } else {
      // Use standard processing
      result = await handleAIResponse(
        supabaseClient,
        aiProvider,
        aiModel,
        finalPrompt,
        promptRunId,
        projectId,
        promptType,
        false, // Standard processing
        contextData
      );
    }
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error processing prompt:', error);
    
    // Attempt to update the prompt run with the error
    if (promptRunId) {
      try {
        await supabaseClient
          .from('prompt_runs')
          .update({ 
            status: 'ERROR',
            error_message: error.message || 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', promptRunId);
      } catch (updateError) {
        console.error('Error updating prompt run with error status:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}
