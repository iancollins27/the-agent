import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration for message batching
const BATCH_CONFIG = {
  // Time window in minutes for batching messages in the same conversation
  TIME_WINDOW_MINUTES: 15,
  // Maximum number of messages to collect before processing a batch
  MAX_BATCH_SIZE: 5,
};

// Function to format phone numbers consistently for comparison
function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Handle international format (e.g., +1234567890)
  // If it doesn't start with country code, we'll assume it's a US number
  if (cleaned.length === 10) {
    // Add US country code if it's a 10-digit number
    cleaned = '1' + cleaned;
  } else if (cleaned.length > 10 && cleaned.startsWith('1')) {
    // Already has country code
    cleaned = cleaned;
  }
  
  return cleaned;
}

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

    // Get request body
    const requestBody = await req.json();
    const { communicationId } = requestBody;

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
    
    // If we have a project_id, determine if we should process this communication now or batch it
    if (projectId) {
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
              message: 'SMS message batched for later processing'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        } else {
          // If we shouldn't batch or the batch criteria is met, process all recent messages
          await processMessagesForProject(supabase, projectId);
        }
      } else {
        // For non-SMS (e.g., CALL), process immediately
        await processCommunicationForProject(supabase, communication, projectId);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        project_id: projectId,
        batched: false
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

// Determines if an SMS message should be batched based on recent activity
async function shouldBatchMessage(supabase: any, communication: any, projectId: string): Promise<boolean> {
  // Get the timestamp for the cutoff window
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - BATCH_CONFIG.TIME_WINDOW_MINUTES);
  
  // See if there's a batch in progress for this project and conversation
  const { data: batchStatus, error: batchStatusError } = await supabase
    .from('comms_batch_status')
    .select('*')
    .eq('project_id', projectId)
    .eq('batch_status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (batchStatusError && batchStatusError.code !== 'PGRST116') {
    console.error('Error checking batch status:', batchStatusError);
  }
  
  if (batchStatus) {
    // There's already a batch in progress
    console.log('Found existing batch in progress:', batchStatus.id);
    
    // Check if we've reached the maximum batch size
    const { count, error: countError } = await supabase
      .from('communications')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('batch_id', batchStatus.id);
      
    if (countError) {
      console.error('Error counting messages in batch:', countError);
      return true; // Default to batching if there's an error
    }
    
    if (count >= BATCH_CONFIG.MAX_BATCH_SIZE) {
      // We've reached the max batch size, so we should process now
      console.log(`Batch size limit reached (${count} messages). Processing now.`);
      return false;
    }
    
    // Otherwise, continue batching
    return true;
  }
  
  // If there's no existing batch, check if this is the first message in a new conversation
  // or if it's continuing an existing conversation that should start a new batch
  const { data: recentMessages, error: recentError } = await supabase
    .from('communications')
    .select('id, timestamp')
    .eq('project_id', projectId)
    .eq('type', 'SMS')
    .gt('timestamp', cutoffTime.toISOString())
    .order('timestamp', { ascending: false });
    
  if (recentError) {
    console.error('Error checking recent messages:', recentError);
    return false; // Process immediately if there's an error
  }
  
  // If there are no recent messages, this is the first message - process immediately
  if (!recentMessages || recentMessages.length === 0) {
    console.log('This appears to be the first message in a conversation. Processing immediately.');
    return false;
  }
  
  // Otherwise, start a new batch
  console.log(`Found ${recentMessages.length} recent messages. Starting a new batch.`);
  return true;
}

// Marks a message as part of a batch
async function markMessageForBatch(supabase: any, communicationId: string, projectId: string): Promise<void> {
  // Get or create a batch for this project
  let batchId: string;
  
  const { data: existingBatch, error: batchError } = await supabase
    .from('comms_batch_status')
    .select('id')
    .eq('project_id', projectId)
    .eq('batch_status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (batchError && batchError.code !== 'PGRST116') {
    console.error('Error getting existing batch:', batchError);
  }
  
  if (existingBatch) {
    batchId = existingBatch.id;
  } else {
    // Create a new batch
    const { data: newBatch, error: createError } = await supabase
      .from('comms_batch_status')
      .insert({
        project_id: projectId,
        batch_status: 'in_progress',
        scheduled_processing_time: new Date(Date.now() + BATCH_CONFIG.TIME_WINDOW_MINUTES * 60 * 1000).toISOString()
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating batch:', createError);
      return;
    }
    
    batchId = newBatch.id;
  }
  
  // Update the communication to mark it as part of the batch
  const { error: updateError } = await supabase
    .from('communications')
    .update({ batch_id: batchId })
    .eq('id', communicationId);
    
  if (updateError) {
    console.error('Error marking message for batch:', updateError);
  }
}

// Process all communications in a batch for a project
async function processMessagesForProject(supabase: any, projectId: string): Promise<void> {
  console.log(`Processing all recent messages for project ${projectId}`);
  
  // Get all batched messages for this project
  const { data: batchedMessages, error: batchError } = await supabase
    .from('communications')
    .select('*')
    .eq('project_id', projectId)
    .not('batch_id', 'is', null)
    .order('timestamp', { ascending: true });
    
  if (batchError) {
    console.error('Error fetching batched messages:', batchError);
    return;
  }
  
  if (!batchedMessages || batchedMessages.length === 0) {
    console.log('No batched messages found to process');
    return;
  }
  
  console.log(`Found ${batchedMessages.length} batched messages to process`);
  
  // Mark batches as processing
  const batchIds = [...new Set(batchedMessages.map(msg => msg.batch_id))];
  for (const batchId of batchIds) {
    const { error: updateError } = await supabase
      .from('comms_batch_status')
      .update({ batch_status: 'processing' })
      .eq('id', batchId);
      
    if (updateError) {
      console.error(`Error updating batch ${batchId} status:`, updateError);
    }
  }
  
  // Combine the messages into a unified context for the AI
  const combinedContext = {
    communication_type: 'SMS',
    communication_subtype: 'batch',
    communication_direction: 'mixed',
    communication_content: batchedMessages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.direction}: ${msg.content}`
    ).join('\n\n'),
    communication_participants: batchedMessages[0].participants, // Using the first message's participants
    communication_timestamp: new Date().toISOString(),
    batch_size: batchedMessages.length,
    batch_start: batchedMessages[0].timestamp,
    batch_end: batchedMessages[batchedMessages.length - 1].timestamp
  };
  
  // Process the combined batch with the AI
  await updateProjectWithAI(supabase, projectId, combinedContext);
  
  // Mark batches as completed
  for (const batchId of batchIds) {
    const { error: updateError } = await supabase
      .from('comms_batch_status')
      .update({ 
        batch_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', batchId);
      
    if (updateError) {
      console.error(`Error updating batch ${batchId} status:`, updateError);
    }
  }
  
  console.log(`Successfully processed ${batchedMessages.length} messages in ${batchIds.length} batches`);
}

// Process a single communication for a project
async function processCommunicationForProject(supabase: any, communication: any, projectId: string): Promise<void> {
  console.log(`Processing individual communication ${communication.id} for project ${projectId}`);
  
  const contextData = {
    communication_type: communication.type,
    communication_subtype: communication.subtype,
    communication_direction: communication.direction,
    communication_content: communication.content || '',
    communication_participants: communication.participants,
    communication_timestamp: communication.timestamp
  };
  
  await updateProjectWithAI(supabase, projectId, contextData);
}

// Update project with AI using the provided context data
async function updateProjectWithAI(supabase: any, projectId: string, contextData: any): Promise<void> {
  try {
    // Prepare the data for AI processing
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id, 
        summary, 
        next_step, 
        project_track, 
        project_tracks(name, description)
      `)
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error('Error fetching project:', projectError);
      return;
    }
    
    // Get latest workflow prompt for summary_update
    const { data: summaryPrompt, error: summaryPromptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'summary_update')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (summaryPromptError) {
      console.error('Error fetching summary workflow prompt:', summaryPromptError);
      return;
    }
    
    // Get AI configuration
    const { data: aiConfig, error: aiConfigError } = await supabase
      .from('ai_config')
      .select('provider, model')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    const aiProvider = aiConfig?.provider || 'openai';
    const aiModel = aiConfig?.model || 'gpt-4o';
    
    // Call the AI to update the summary
    console.log('Calling test-workflow-prompt for summary update');
    const summaryContext = {
      summary: project.summary || '',
      track_name: project.project_tracks?.name || 'Default Track',
      current_date: new Date().toISOString().split('T')[0],
      new_data: contextData
    };
    
    const { data: summaryResult, error: summaryWorkflowError } = await supabase.functions.invoke(
      'test-workflow-prompt',
      {
        body: {
          promptType: 'summary_update',
          promptText: summaryPrompt.prompt_text,
          projectId: projectId,
          contextData: summaryContext,
          aiProvider: aiProvider,
          aiModel: aiModel,
          workflowPromptId: summaryPrompt.id,
          initiatedBy: 'communications-webhook'
        }
      }
    );
    
    if (summaryWorkflowError) {
      console.error('Error calling summary workflow prompt:', summaryWorkflowError);
      return;
    }
    
    console.log('Project summary updated successfully');
    
    // Now run action detection and execution
    const { data: actionPrompt, error: actionPromptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'action_detection_execution')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (actionPromptError) {
      console.error('Error fetching action workflow prompt:', actionPromptError);
      return;
    }
    
    // Get updated project data with the new summary
    const { data: updatedProject, error: updatedProjectError } = await supabase
      .from('projects')
      .select(`
        id, 
        summary, 
        next_step, 
        project_track, 
        project_tracks(name, description, Roles, "track base prompt")
      `)
      .eq('id', projectId)
      .single();
      
    if (updatedProjectError) {
      console.error('Error fetching updated project:', updatedProjectError);
      return;
    }
    
    // Call the AI to detect and execute actions
    console.log('Calling test-workflow-prompt for action detection and execution');
    const actionContext = {
      summary: updatedProject.summary || '',
      track_name: updatedProject.project_tracks?.name || 'Default Track',
      track_roles: updatedProject.project_tracks?.Roles || '',
      track_base_prompt: updatedProject.project_tracks?.["track base prompt"] || '',
      current_date: new Date().toISOString().split('T')[0],
      next_step: updatedProject.next_step || '',
      new_data: contextData,
      is_reminder_check: false
    };
    
    const { data: actionResult, error: actionWorkflowError } = await supabase.functions.invoke(
      'test-workflow-prompt',
      {
        body: {
          promptType: 'action_detection_execution',
          promptText: actionPrompt.prompt_text,
          projectId: projectId,
          contextData: actionContext,
          aiProvider: aiProvider,
          aiModel: aiModel,
          workflowPromptId: actionPrompt.id,
          initiatedBy: 'communications-webhook'
        }
      }
    );
    
    if (actionWorkflowError) {
      console.error('Error calling action workflow prompt:', actionWorkflowError);
      return;
    }
    
    console.log('Project action detection and execution completed successfully');
  } catch (error) {
    console.error('Error updating project with AI:', error);
  }
}

async function findProjectByPhoneNumber(supabase: any, communication: any): Promise<string | null> {
  try {
    // Extract phone numbers from the communication
    const phoneNumbers = communication.participants
      .filter((p: any) => p.type === 'phone')
      .map((p: any) => p.value);
      
    if (phoneNumbers.length === 0) {
      return null;
    }
    
    console.log('Searching for project match using phone numbers:', phoneNumbers);
    
    // Format the phone numbers for consistent comparison
    const formattedPhoneNumbers = phoneNumbers.map(formatPhoneNumber);
    console.log('Formatted phone numbers for search:', formattedPhoneNumbers);
    
    // Build a query to search for contacts with matching phone numbers
    // This uses LIKE queries for flexibility in matching different phone number formats
    const searchQuery = formattedPhoneNumbers.map((phone: string, index: number) => {
      return `phone_number.ilike.%${phone.substring(Math.max(0, phone.length - 10))}%`;
    }).join(',');
    
    console.log('Using search query:', searchQuery);
    
    // Query contacts table directly with the phone numbers
    const { data: matchingContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id')
      .or(searchQuery);
      
    if (contactsError) {
      console.error('Error searching contacts:', contactsError);
      return null;
    }
    
    if (!matchingContacts || matchingContacts.length === 0) {
      console.log('No matching contacts found');
      return null;
    }
    
    console.log('Found matching contacts:', matchingContacts);
    
    const contactIds = matchingContacts.map((c: any) => c.id);
    
    // Find projects associated with these contacts
    const { data: projectContacts, error: projectContactsError } = await supabase
      .from('project_contacts')
      .select('project_id')
      .in('contact_id', contactIds)
      .limit(1);
      
    if (projectContactsError) {
      console.error('Error searching project contacts:', projectContactsError);
      return null;
    }
    
    if (!projectContacts || projectContacts.length === 0) {
      console.log('No matching projects found');
      return null;
    }
    
    console.log('Found matching project:', projectContacts[0].project_id);
    return projectContacts[0].project_id;
  } catch (error) {
    console.error('Error in findProjectByPhoneNumber:', error);
    return null;
  }
}
