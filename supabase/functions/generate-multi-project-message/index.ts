
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    const { projectIds, rooferName } = await req.json();
    
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No project IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create a Supabase client using the service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating multi-project message for roofer: ${rooferName}, projects: ${projectIds.length}`);

    // 1. Fetch project data for all provided project IDs
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, summary, next_step, Address')
      .in('id', projectIds);

    if (projectError) {
      console.error(`Error fetching projects: ${JSON.stringify(projectError)}`);
      throw new Error(`Error fetching projects: ${projectError.message}`);
    }

    if (!projects || projects.length === 0) {
      throw new Error('No projects found with the provided IDs. Please check if the IDs are valid.');
    }

    console.log(`Found ${projects.length} projects`);

    // 2. Fetch the most recent prompt runs for these projects
    const { data: promptRuns, error: promptRunsError } = await supabase
      .from('prompt_runs')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false });

    if (promptRunsError) {
      throw new Error(`Error fetching prompt runs: ${promptRunsError.message}`);
    }

    // 3. Fetch related action records - specifically pending actions
    const { data: actionRecords, error: actionsError } = await supabase
      .from('action_records')
      .select('*')
      .in('project_id', projectIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (actionsError) {
      throw new Error(`Error fetching action records: ${actionsError.message}`);
    }

    if (!actionRecords || actionRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No pending actions found for these projects',
          projectCount: 0
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${actionRecords.length} pending actions`);

    // 4. Fetch the workflow prompt from the database
    const { data: workflowPrompt, error: workflowPromptError } = await supabase
      .from('workflow_prompts')
      .select('prompt_text')
      .eq('type', 'multi_project_message_generation')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (workflowPromptError) {
      console.error(`Error fetching workflow prompt: ${JSON.stringify(workflowPromptError)}`);
      // If we can't fetch the prompt, use a default one
      const defaultPrompt = `
      You need to create a consolidated message to send to a roofer named {{rooferName}} regarding multiple projects that require their attention.
      
      These are the projects and their details:
      {{projectData}}
      
      Your task:
      1. Analyze each project's latest prompt run and pending actions
      2. Group projects with similar required actions or status
      3. Create a concise but comprehensive message that:
         - Greets the roofer by name
         - Mentions each project (using the address as identifier)
         - Clearly states what is needed from the roofer for each project
         - Groups similar actions when possible
         - Maintains a professional but friendly tone
         - Ends with an appropriate closing
         - Keeps the message under 500 words
         - ONLY includes actionable items that require the roofer's attention
      
      Return ONLY the final message text, with no additional explanations.`;
      workflowPrompt = { prompt_text: defaultPrompt };
    }

    // Get the OpenAI API key
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Organize data for each project
    const projectData = projects.map(project => {
      const relatedRuns = promptRuns ? promptRuns.filter(run => run.project_id === project.id) : [];
      const relatedActions = actionRecords ? actionRecords.filter(action => action.project_id === project.id) : [];
      
      // Only include projects that have pending actions
      if (relatedActions.length === 0) {
        return null;
      }
      
      return {
        id: project.id,
        address: project.Address,
        summary: project.summary,
        nextStep: project.next_step,
        latestRun: relatedRuns.length > 0 ? relatedRuns[0] : null,
        pendingActions: relatedActions
      };
    }).filter(Boolean); // Remove null entries
    
    if (projectData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No projects with pending actions found',
          projectCount: 0
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Replace placeholders in the prompt
    let promptContent = workflowPrompt.prompt_text
      .replace(/{{rooferName}}/g, rooferName)
      .replace(/{{projectData}}/g, JSON.stringify(projectData, null, 2))
      .replace(/{{current_date}}/g, new Date().toISOString().split('T')[0]);

    console.log('Sending request to OpenAI');
    
    // Call OpenAI API to generate the consolidated message
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that helps project managers communicate effectively with roofers about pending actions.'
          },
          {
            role: 'user',
            content: promptContent
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid response from OpenAI API');
    }

    const message = data.choices[0].message.content.trim();
    
    console.log('Successfully generated consolidated message');

    // Return the generated consolidated message
    return new Response(
      JSON.stringify({ 
        message,
        projectCount: projectData.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-multi-project-message function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
