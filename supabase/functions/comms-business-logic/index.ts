
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./utils/config.ts";
import { findProjectByPhoneNumber } from "./services/projectFinder.ts";
import { isPotentialMultiProjectComm } from "./services/multiProjectDetector.ts";
import { 
  shouldBatchMessage, 
  markMessageForBatch 
} from "./services/messageBatcher.ts";
import { 
  processMessagesForProject, 
  processCommunicationForProject 
} from "./services/messageProcessor.ts";
import { 
  processMultiProjectCommunication, 
  processMultiProjectMessages 
} from "./services/multiProjectProcessor.ts";
import { processDueBatches } from "./services/batchProcessor.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check for any due batches and process them first
    // We do this on every invocation to ensure batches don't get "stuck"
    const processedBatches = await processDueBatches(supabase);
    console.log(`Processed ${processedBatches} due batches during function invocation`);
    
    // Get request body
    const requestBody = await req.json();
    const { communicationId, processBatchesOnly } = requestBody;

    // If this is just a batch processing request, return early
    if (processBatchesOnly) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed_batches: processedBatches,
          message: "Processed due batches successfully"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!communicationId) {
      return new Response(
        JSON.stringify({ error: 'Missing communicationId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing business logic for communication: ${communicationId}`);

    // Fetch the communication from database
    const { data: communication, error: fetchError } = await supabase
      .from('communications')
      .select('*')
      .eq('id', communicationId)
      .single();

    if (fetchError || !communication) {
      console.error('Error fetching communication:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Communication not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if a project_id is already assigned
    let projectId = communication.project_id;
    
    // If no project is assigned, try to find a match based on phone number
    if (!projectId) {
      projectId = await findProjectByPhoneNumber(supabase, communication);
      
      if (projectId) {
        // Update the communication with the project_id
        const { error: updateError } = await supabase
          .from('communications')
          .update({ project_id: projectId })
          .eq('id', communicationId);
          
        if (updateError) {
          console.error('Error updating communication with project ID:', updateError);
        } else {
          console.log(`Associated communication with project ID: ${projectId}`);
        }
      } else {
        console.log('No project match found for this communication');
      }
    }
    
    // Determine if this is potentially a multi-project communication
    const isMultiProjectCommunication = await isPotentialMultiProjectComm(supabase, communication);
    console.log(`Is potential multi-project communication: ${isMultiProjectCommunication}`);
    
    if (isMultiProjectCommunication) {
      // Update the communication to mark it as multi-project
      const { error: updateError } = await supabase
        .from('communications')
        .update({ multi_project_potential: true })
        .eq('id', communicationId);
        
      if (updateError) {
        console.error('Error marking communication as multi-project:', updateError);
      }
    }
    
    // If we have a project_id or this is a multi-project communication, determine if we should process this communication now or batch it
    if (projectId || isMultiProjectCommunication) {
      // For multi-project communications or if it's SMS
      if (communication.type === 'SMS') {
        // Check if this SMS should be batched
        const shouldBatch = await shouldBatchMessage(supabase, communication, projectId);
        
        if (shouldBatch) {
          console.log('Batching SMS message for later processing');
          await markMessageForBatch(supabase, communicationId, projectId);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              project_id: projectId,
              batched: true,
              multi_project: isMultiProjectCommunication,
              message: 'SMS message batched for later processing'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        } else {
          // If we shouldn't batch or the batch criteria is met, process all recent messages
          if (isMultiProjectCommunication) {
            await processMultiProjectMessages(supabase, projectId, communication.batch_id);
          } else {
            await processMessagesForProject(supabase, projectId);
          }
        }
      } else {
        // For non-SMS (e.g., CALL)
        if (isMultiProjectCommunication) {
          // Process as multi-project communication
          await processMultiProjectCommunication(supabase, communication);
        } else {
          // Process for single project
          await processCommunicationForProject(supabase, communication, projectId);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        project_id: projectId,
        batched: false,
        multi_project: isMultiProjectCommunication,
        processed_batches: processedBatches
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in business logic handler:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
