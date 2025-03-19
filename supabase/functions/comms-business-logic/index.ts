
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    // If we have a project_id, process for project-level actions
    if (projectId) {
      // For SMS or CALL, update the project summary using a summary_update workflow
      
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
      } else {
        // Get latest workflow prompt for summary_update
        const { data: prompt, error: promptError } = await supabase
          .from('workflow_prompts')
          .select('*')
          .eq('type', 'summary_update')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (promptError) {
          console.error('Error fetching workflow prompt:', promptError);
        } else {
          // Call the test-workflow-prompt function to update the project summary
          const contextData = {
            summary: project.summary || '',
            track_name: project.project_tracks?.name || 'Default Track',
            current_date: new Date().toISOString().split('T')[0],
            new_data: {
              communication_type: communication.type,
              communication_subtype: communication.subtype,
              communication_direction: communication.direction,
              communication_content: communication.content || '',
              communication_participants: communication.participants,
              communication_timestamp: communication.timestamp
            }
          };
          
          // Get AI configuration
          const { data: aiConfig, error: aiConfigError } = await supabase
            .from('ai_config')
            .select('provider, model')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          const aiProvider = aiConfig?.provider || 'openai';
          const aiModel = aiConfig?.model || 'gpt-4o';
          
          console.log('Calling test-workflow-prompt for communication update');
          
          const { data: result, error: workflowError } = await supabase.functions.invoke(
            'test-workflow-prompt',
            {
              body: {
                promptType: 'summary_update',
                promptText: prompt.prompt_text,
                projectId: projectId,
                contextData: contextData,
                aiProvider: aiProvider,
                aiModel: aiModel,
                workflowPromptId: prompt.id,
                initiatedBy: 'communications-webhook'
              }
            }
          );
          
          if (workflowError) {
            console.error('Error calling workflow prompt:', workflowError);
          } else {
            console.log('Project summary updated successfully');
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        project_id: projectId 
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

async function findProjectByPhoneNumber(supabase: any, communication: any): Promise<string | null> {
  try {
    // Extract phone numbers from the communication
    const phoneNumbers = communication.participants
      .filter(p => p.type === 'phone')
      .map(p => p.value);
      
    if (phoneNumbers.length === 0) {
      return null;
    }
    
    console.log('Searching for project match using phone numbers:', phoneNumbers);
    
    // Query project_contacts and contacts tables to find a match
    // This is a simplified example - in reality, phone numbers might need normalization
    // for proper matching (removing +, country codes, spaces, etc.)
    
    const { data: matchingContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id')
      .or(phoneNumbers.map(phone => `contact_info.ilike.%${phone}%`).join(','));
      
    if (contactsError) {
      console.error('Error searching contacts:', contactsError);
      return null;
    }
    
    if (!matchingContacts || matchingContacts.length === 0) {
      console.log('No matching contacts found');
      return null;
    }
    
    const contactIds = matchingContacts.map(c => c.id);
    
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
    
    return projectContacts[0].project_id;
  } catch (error) {
    console.error('Error in findProjectByPhoneNumber:', error);
    return null;
  }
}
