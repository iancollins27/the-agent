
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, promptType, promptText, previousResults } = await req.json();

    console.log(`Processing ${promptType} for project ${projectId}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }
      }
    );

    // Enhanced project query to include project track details
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select(`
        *,
        project_tracks (
          name,
          description
        )
      `)
      .eq('id', projectId)
      .single();

    if (projectError) {
      throw new Error(`Failed to fetch project: ${projectError.message}`);
    }

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    console.log('RAW PROJECT DATA:', JSON.stringify(project, null, 2));

    // Include track information in processed data
    const processedData = {
      id: project.id,
      companyId: project.company_id,
      projectTrack: {
        name: project.project_tracks?.name,
        description: project.project_tracks?.description
      },
      summary: project.summary,
      lastActionCheck: project.last_action_check
    };

    console.log('PROCESSED DATA:', JSON.stringify(processedData, null, 2));

    // Generate the final prompt
    let finalPrompt = promptText;

    switch (promptType) {
      case 'summary_generation':
        finalPrompt = finalPrompt.replace('{project_data}', JSON.stringify(processedData, null, 2));
        break;
      
      case 'summary_update':
        finalPrompt = finalPrompt
          .replace('{current_summary}', project.summary || '')
          .replace('{new_data}', JSON.stringify(processedData, null, 2));
        break;
      
      case 'action_detection':
        const summaryForAction = previousResults?.find(r => r.type === 'summary_generation')?.output || project.summary;
        finalPrompt = finalPrompt
          .replace('{summary}', summaryForAction || '')
          .replace('{track_description}', project.project_tracks?.description || 'No track description available');
        break;
      
      case 'action_execution':
        const actionNeeded = previousResults?.find(r => r.type === 'action_detection')?.output;
        finalPrompt = finalPrompt.replace('{action_needed}', actionNeeded || '');
        break;
    }

    console.log('FINAL PROMPT:', finalPrompt);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that processes project data.' },
          { role: 'user', content: finalPrompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      result,
      finalPrompt
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in test-workflow-prompt function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
