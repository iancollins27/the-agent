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
    
    // Determine if this is potentially a multi-project communication
    const isMultiProjectCommunication = await isPotentialMultiProjectComm(supabase, communication);
    console.log(`Is potential multi-project communication: ${isMultiProjectCommunication}`);
    
    // If we have a project_id, determine if we should process this communication now or batch it
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
        multi_project: isMultiProjectCommunication
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

// Check if this communication is potentially related to multiple projects
// (e.g., between a project manager and a roofer)
async function isPotentialMultiProjectComm(supabase: any, communication: any): Promise<boolean> {
  try {
    // Extract participant information
    const participants = communication.participants || [];
    
    // Check if we have at least 2 participants (sender and receiver)
    if (participants.length < 2) {
      return false;
    }
    
    // Track if we found a project manager and a roofer
    let foundProjectManager = false;
    let foundRoofer = false;
    
    // Get phone numbers from participants
    const phoneNumbers = participants
      .filter((p: any) => p.type === 'phone')
      .map((p: any) => p.value);
      
    if (phoneNumbers.length < 2) {
      return false;
    }
    
    // Look up contacts associated with these phone numbers
    for (const phone of phoneNumbers) {
      const formattedPhone = formatPhoneNumber(phone);
      
      // Query to find this contact
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('role')
        .ilike('phone_number', `%${formattedPhone.slice(-10)}%`)
        .limit(1);
        
      if (error) {
        console.error('Error looking up contact role:', error);
        continue;
      }
      
      if (contacts && contacts.length > 0) {
        const role = contacts[0].role;
        if (role === 'project_manager' || role === 'ProjectManager' || role === 'PM' || role === 'bidlist_pm') {
          foundProjectManager = true;
        } else if (role === 'roofer' || role === 'contractor' || role === 'vendor') {
          foundRoofer = true;
        }
      }
    }
    
    // If we found both a project manager and a roofer, this might be a multi-project communication
    return foundProjectManager && foundRoofer;
  } catch (error) {
    console.error('Error determining multi-project status:', error);
    return false;
  }
}

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
        project_tracks(name, description, Roles, "track base prompt")
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

// Process a communication that might reference multiple projects
async function processMultiProjectCommunication(supabase: any, communication: any): Promise<void> {
  console.log(`Processing multi-project communication ${communication.id}`);
  
  try {
    // Get all active projects to check against
    const { data: allProjects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        summary,
        Address,
        crm_id,
        next_step,
        company_id,
        project_track,
        project_tracks(name, description, Roles, "track base prompt")
      `)
      .is('next_check_date', null) // Only consider active projects
      .order('created_at', { ascending: false })
      .limit(100); // Reasonable limit to check against
      
    if (projectsError) {
      console.error('Error fetching projects for multi-project analysis:', projectsError);
      return;
    }
    
    if (!allProjects || allProjects.length === 0) {
      console.log('No active projects found for multi-project analysis');
      return;
    }
    
    // Convert the communication into context for the AI
    const commContent = communication.content || 
      (communication.recording_url ? `[Recording available at: ${communication.recording_url}]` : 'No content available');
    
    const contextData = {
      communication_type: communication.type,
      communication_subtype: communication.subtype,
      communication_direction: communication.direction,
      communication_content: commContent,
      communication_participants: communication.participants,
      communication_timestamp: communication.timestamp,
      communication_duration: communication.duration,
      projects_data: allProjects.map(p => ({
        id: p.id,
        summary: p.summary || '',
        address: p.Address || '',
        next_step: p.next_step || '',
      })),
      multi_project_analysis: true
    };
    
    // Get latest workflow prompt for multi-project analysis
    const { data: multiProjectPrompt, error: promptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'multi_project_analysis')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (promptError && promptError.code !== 'PGRST116') {
      console.error('Error fetching multi-project analysis prompt:', promptError);
      
      // Fall back to summary_update prompt
      const { data: fallbackPrompt, error: fallbackError } = await supabase
        .from('workflow_prompts')
        .select('*')
        .eq('type', 'summary_update')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (fallbackError) {
        console.error('Error fetching fallback prompt:', fallbackError);
        return;
      }
      
      contextData.multi_project_analysis_instruction = `
        IMPORTANT: This communication appears to be between a project manager and a roofer/contractor.
        It may contain information about multiple projects. Please analyze the content and determine
        which information is relevant to THIS specific project. Only include information that is directly
        relevant to the current project in your summary update.
      `;
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
    
    // If we have a dedicated multi-project analysis prompt, use it
    if (multiProjectPrompt) {
      console.log('Using dedicated multi-project analysis prompt');
      
      // Call the AI to analyze multiple projects
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        'test-workflow-prompt',
        {
          body: {
            promptType: 'multi_project_analysis',
            promptText: multiProjectPrompt.prompt_text,
            projectId: null, // No specific project
            contextData: contextData,
            aiProvider: aiProvider,
            aiModel: aiModel,
            workflowPromptId: multiProjectPrompt.id,
            initiatedBy: 'communications-webhook',
            isMultiProjectTest: true
          }
        }
      );
      
      if (analysisError) {
        console.error('Error calling multi-project analysis:', analysisError);
        return;
      }
      
      // Parse results to get project-specific information
      try {
        const parsedResult = JSON.parse(analysisResult.output);
        
        if (!parsedResult.projects || !Array.isArray(parsedResult.projects)) {
          console.error('Invalid analysis result format:', analysisResult.output);
          return;
        }
        
        // Process each project update
        for (const projectUpdate of parsedResult.projects) {
          if (!projectUpdate.projectId || !projectUpdate.relevantContent) {
            continue;
          }
          
          // Update each relevant project with its specific info
          await updateProjectWithSpecificInfo(
            supabase, 
            projectUpdate.projectId, 
            projectUpdate.relevantContent,
            communication,
            aiProvider,
            aiModel
          );
        }
        
        console.log(`Successfully processed updates for ${parsedResult.projects.length} projects`);
      } catch (parseError) {
        console.error('Error parsing multi-project analysis result:', parseError);
      }
    } else {
      // Fallback: Process updates for each project individually
      console.log('No multi-project analysis prompt found, processing projects individually');
      
      for (const project of allProjects) {
        await updateProjectWithAI(supabase, project.id, {
          ...contextData,
          multi_project_analysis_instruction: `
            IMPORTANT: This communication appears to be between a project manager and a roofer/contractor.
            It may contain information about multiple projects. Please analyze the content and determine
            which information is relevant to THIS specific project (ID: ${project.id}, Address: ${project.Address || 'Unknown'}).
            Only include information that is directly relevant to the current project in your summary update.
          `
        });
      }
    }
  } catch (error) {
    console.error('Error in processMultiProjectCommunication:', error);
  }
}

// Process all messages in a batch for multiple projects
async function processMultiProjectMessages(supabase: any, projectId: string, batchId: string): Promise<void> {
  console.log(`Processing multi-project batch for batch ${batchId}`);
  
  try {
    // Get all messages in this batch
    const { data: batchMessages, error: batchError } = await supabase
      .from('communications')
      .select('*')
      .eq('batch_id', batchId)
      .order('timestamp', { ascending: true });
      
    if (batchError) {
      console.error('Error fetching batch messages:', batchError);
      return;
    }
    
    if (!batchMessages || batchMessages.length === 0) {
      console.log('No batched messages found to process');
      return;
    }
    
    // Mark batch as processing
    const { error: updateError } = await supabase
      .from('comms_batch_status')
      .update({ batch_status: 'processing' })
      .eq('id', batchId);
      
    if (updateError) {
      console.error(`Error updating batch ${batchId} status:`, updateError);
    }
    
    // Combine the messages
    const combinedContent = batchMessages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.direction}: ${msg.content}`
    ).join('\n\n');
    
    // Create a synthetic communication object to represent the batch
    const batchCommunication = {
      id: batchId,
      type: 'SMS',
      subtype: 'batch',
      direction: 'mixed',
      content: combinedContent,
      participants: batchMessages[0].participants,
      timestamp: new Date().toISOString(),
      duration: null,
      batch_id: batchId
    };
    
    // Use the multi-project processing function
    await processMultiProjectCommunication(supabase, batchCommunication);
    
    // Mark batch as completed
    const { error: completeError } = await supabase
      .from('comms_batch_status')
      .update({ 
        batch_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', batchId);
      
    if (completeError) {
      console.error(`Error marking batch ${batchId} as completed:`, completeError);
    }
    
    console.log(`Successfully processed multi-project batch ${batchId}`);
  } catch (error) {
    console.error('Error in processMultiProjectMessages:', error);
  }
}

// Update a specific project with its relevant information extracted from a multi-project communication
async function updateProjectWithSpecificInfo(
  supabase: any, 
  projectId: string, 
  relevantContent: string,
  communication: any,
  aiProvider: string,
  aiModel: string
): Promise<void> {
  try {
    // Get the project details
    const { data: project, error: projectError } = await supabase
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
      
    if (projectError) {
      console.error(`Error fetching project ${projectId}:`, projectError);
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
    
    // Prepare context data with the relevant content for this specific project
    const contextData = {
      summary: project.summary || '',
      track_name: project.project_tracks?.name || 'Default Track',
      track_roles: project.project_tracks?.Roles || '',
      track_base_prompt: project.project_tracks?.["track base prompt"] || '',
      current_date: new Date().toISOString().split('T')[0],
      new_data: {
        communication_type: communication.type,
        communication_subtype: communication.subtype || 'multi_project',
        communication_direction: communication.direction,
        communication_content: relevantContent, // Only the relevant content for this project
        communication_timestamp: communication.timestamp,
        extracted_from_multi_project: true
      }
    };
    
    // Call the AI to update the summary
    console.log(`Updating project ${projectId} with its relevant content`);
    const { data: summaryResult, error: summaryWorkflowError } = await supabase.functions.invoke(
      'test-workflow-prompt',
      {
        body: {
          promptType: 'summary_update',
          promptText: summaryPrompt.prompt_text,
          projectId: projectId,
          contextData: contextData,
          aiProvider: aiProvider,
          aiModel: aiModel,
          workflowPromptId: summaryPrompt.id,
          initiatedBy: 'communications-webhook'
        }
      }
    );
    
    if (summaryWorkflowError) {
      console.error(`Error updating summary for project ${projectId}:`, summaryWorkflowError);
      return;
    }
    
    console.log(`Successfully updated project ${projectId} with its relevant content`);
    
    // Now run action detection and execution as usual
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
      console.error(`Error fetching updated project ${projectId}:`, updatedProjectError);
      return;
    }
    
    // Call the AI to detect and execute actions
    console.log(`Running action detection for project ${projectId}`);
    const actionContext = {
      summary: updatedProject.summary || '',
      track_name: updatedProject.project_tracks?.name || 'Default Track',
      track_roles: updatedProject.project_tracks?.Roles || '',
      track_base_prompt: updatedProject.project_tracks?.["track base prompt"] || '',
      current_date: new Date().toISOString().split('T')[0],
      next_step: updatedProject.next_step || '',
      new_data: contextData.new_data,
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
      console.error(`Error running action detection for project ${projectId}:`, actionWorkflowError);
      return;
    }
    
    console.log(`Successfully completed action detection for project ${projectId}`);
  } catch (error) {
    console.error(`Error in updateProjectWithSpecificInfo for project ${projectId}:`, error);
  }
}
