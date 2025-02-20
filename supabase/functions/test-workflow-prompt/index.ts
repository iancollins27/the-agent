
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.1.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert timeline data from date strings to a more readable format
const processTimelineData = (data: any) => {
  const timeline: Record<string, string | null> = {
    contractSigned: data.Contract_Signed || null,
    siteVisitScheduled: data.Site_Visit_Scheduled || null,
    workOrderConfirmed: data.Work_Order_Confirmed || null,
    roofInstallApproved: data.Roof_Install_Approved || null,
    roofInstallScheduled: data.Install_Scheduled || null,
    installDateConfirmedByRoofer: data.Install_Date_Confirmed_by_Roofer || null,
    roofInstallComplete: data.Roof_Install_Complete || null,
    roofInstallFinalized: data.Roof_Install_Finalized || null
  };

  // Create a more readable version of the timeline
  const processedData = {
    ...data,
    timeline: Object.entries(timeline).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: value ? {
        status: 'completed',
        completedAt: value
      } : {
        status: 'pending',
        completedAt: null
      }
    }), {})
  };

  return processedData;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);
    const { projectId, promptType, promptText, previousResults } = await req.json();

    console.log(`Processing ${promptType} for project ${projectId}`);
    console.log('Previous results:', previousResults);

    // Fetch project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    // Process the project data to handle date/time values
    const processedProject = processTimelineData(project);

    // Generate the final prompt by replacing placeholders based on prompt type
    let finalPrompt = promptText;

    switch (promptType) {
      case 'summary_generation':
        finalPrompt = finalPrompt.replace('{project_data}', JSON.stringify(processedProject, null, 2));
        break;
      
      case 'summary_update':
        finalPrompt = finalPrompt
          .replace('{current_summary}', processedProject.summary || '')
          .replace('{new_data}', JSON.stringify(processedProject, null, 2));
        break;
      
      case 'action_detection':
        const summaryForAction = previousResults?.find(r => r.type === 'summary_generation')?.output || processedProject.summary;
        finalPrompt = finalPrompt.replace('{summary}', summaryForAction || '');
        break;
      
      case 'action_execution':
        const actionNeeded = previousResults?.find(r => r.type === 'action_detection')?.output;
        finalPrompt = finalPrompt.replace('{action_needed}', actionNeeded || '');
        break;
    }

    console.log(`Final prompt for ${promptType}:`, finalPrompt);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that processes project data.' },
          { role: 'user', content: finalPrompt }
        ],
      }),
    });

    const data = await response.json();
    const result = data.choices[0].message.content;

    console.log(`Result for ${promptType}:`, result);

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
