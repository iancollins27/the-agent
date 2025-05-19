
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
  processCommunicationForProject,
  processMultiProjectMessages
} from "./services/messageProcessor.ts";
import { 
  processMultiProjectCommunication
} from "./services/multiProjectProcessor.ts";
import { processDueBatches } from "./services/batchProcessor.ts";
import {
  getSessionContext,
  updateSessionHistory,
  markCommunicationProcessed
} from "./services/sessionHandler.ts";

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

    let processedBatches = 0;
    
    try {
      // Check for any due batches and process them first
      // We do this on every invocation to ensure batches don't get "stuck"
      processedBatches = await processDueBatches(supabase);
      console.log(`Processed ${processedBatches} due batches during function invocation`);
    } catch (batchError) {
      console.error('Error processing batches, but continuing:', batchError);
      // Continue with other processing even if batch processing fails
    }
    
    // Get request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
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
        JSON.stringify({ error: 'Communication not found', details: fetchError }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // NEW: Get or create a session for this communication
    const sessionContext = await getSessionContext(supabase, communicationId);
    
    console.log('Communication details:', {
      id: communication.id,
      type: communication.type,
      subtype: communication.subtype, 
      content: communication.content ? communication.content.substring(0, 50) + '...' : null,
      participantCount: communication.participants?.length || 0,
      project_id: communication.project_id,
      is_call: communication.type === 'CALL',
      has_recording: !!communication.recording_url,
      session_id: sessionContext?.sessionId || null
    });

    // Check if a project_id is already assigned
    let projectId = communication.project_id;
    
    // If no project is assigned, try to find a match based on phone number
    if (!projectId) {
      try {
        console.log('No project ID assigned, attempting to find match based on phone number');
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
      } catch (projectFindError) {
        console.error('Error finding project by phone number:', projectFindError);
        // Continue processing even if project finding fails
      }
    } else {
      console.log(`Communication already has project ID: ${projectId}`);
    }

    // Update session with project ID if needed
    if (projectId && sessionContext && !sessionContext.projectId) {
      // Update the session with the project ID
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({ project_id: projectId })
        .eq('id', sessionContext.sessionId);
        
      if (updateError) {
        console.error('Error updating session with project ID:', updateError);
      }
    }
    
    // Determine if this is potentially a multi-project communication
    let isMultiProjectCommunication = false;
    try {
      isMultiProjectCommunication = await isPotentialMultiProjectComm(supabase, communication);
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
    } catch (multiProjectError) {
      console.error('Error determining multi-project status:', multiProjectError);
      // Continue with normal processing if multi-project detection fails
    }
    
    // NEW: Add message to conversation history if session exists
    if (sessionContext && communication.content) {
      const isInbound = communication.direction.toUpperCase() === 'INBOUND';
      
      // Add the message to the conversation history
      await updateSessionHistory(supabase, sessionContext.sessionId, {
        role: 'user',
        content: communication.content,
        timestamp: communication.timestamp || new Date().toISOString()
      });
    }
    
    // If we have a project_id or this is a multi-project communication, determine if we should process this communication now or batch it
    if (projectId || isMultiProjectCommunication) {
      try {
        // Special handling for CALL type communications - always process them immediately without batching
        if (communication.type === 'CALL') {
          console.log('Processing CALL immediately without batching');
          if (isMultiProjectCommunication) {
            await processMultiProjectCommunication(supabase, communication);
          } else {
            await processCommunicationForProject(supabase, communication, projectId);
          }
        }
        // For SMS or EMAIL type communications
        else if (communication.type === 'SMS' || communication.type === 'EMAIL') {
          console.log(`Processing ${communication.type} message, checking if it should be batched`);
          
          let shouldBatch = false;
          
          try {
            // Check if this message should be batched
            shouldBatch = projectId ? await shouldBatchMessage(supabase, communication, projectId) : false;
          } catch (batchCheckError) {
            console.error('Error checking batch status:', batchCheckError);
            // Default to not batching if batch check fails
            shouldBatch = false;
          }
          
          if (shouldBatch) {
            console.log(`Batching ${communication.type} message for later processing`);
            try {
              await markMessageForBatch(supabase, communicationId, projectId);
              
              // Mark communication as processed
              if (sessionContext) {
                await markCommunicationProcessed(supabase, communicationId, sessionContext.sessionId);
              }
              
              return new Response(
                JSON.stringify({ 
                  success: true, 
                  project_id: projectId,
                  batched: true,
                  multi_project: isMultiProjectCommunication,
                  session_id: sessionContext?.sessionId || null,
                  message: `${communication.type} message batched for later processing`
                }),
                { 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            } catch (batchError) {
              console.error('Error during batch assignment:', batchError);
              // Continue with processing if batching fails
            }
          } else {
            // If we shouldn't batch or the batch criteria is met, process all recent messages
            console.log(`Processing ${communication.type} now without batching`);
            if (isMultiProjectCommunication) {
              await processMultiProjectMessages(supabase, projectId, communication.batch_id);
            } else {
              await processMessagesForProject(supabase, projectId);
            }
          }
        } else {
          // For other communication types (not CALL, SMS, or EMAIL)
          console.log(`Processing non-standard communication of type: ${communication.type}`);
          if (isMultiProjectCommunication) {
            // Process as multi-project communication
            await processMultiProjectCommunication(supabase, communication);
          } else {
            // Process for single project
            await processCommunicationForProject(supabase, communication, projectId);
          }
        }
      } catch (processingError) {
        console.error('Error during communication processing:', processingError);
        // Return a success response even if processing fails to prevent retries
        // The error is logged and can be handled through monitoring
        return new Response(
          JSON.stringify({ 
            success: false, 
            project_id: projectId,
            batched: false,
            multi_project: isMultiProjectCommunication,
            processed_batches: processedBatches,
            session_id: sessionContext?.sessionId || null,
            error: processingError.message
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Mark communication as processed
    if (sessionContext) {
      await markCommunicationProcessed(supabase, communicationId, sessionContext.sessionId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        project_id: projectId,
        batched: false,
        multi_project: isMultiProjectCommunication,
        processed_batches: processedBatches,
        session_id: sessionContext?.sessionId || null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in business logic handler:', error);
    
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
