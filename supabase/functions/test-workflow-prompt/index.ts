
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

// Helper function to convert boolean timeline data to a more readable format
const processTimelineData = (data: any) => {
  // First, let's fetch the actual dates from the project data if they exist
  const timelineDates = {
    Contract_Signed_Date: data.Contract_Signed_Date,
    Site_Visit_Date: data.Site_Visit_Date,
    Work_Order_Date: data.Work_Order_Date,
    Roof_Install_Approval_Date: data.Roof_Install_Approval_Date,
    Install_Schedule_Date: data.Install_Schedule_Date,
    Roofer_Confirmation_Date: data.Roofer_Confirmation_Date,
    Install_Complete_Date: data.Install_Complete_Date,
    Install_Finalized_Date: data.Install_Finalized_Date
  };

  // Create a processed version of the timeline that includes both status and dates
  const processedData = {
    ...data,
    timeline: {
      contractSigned: {
        status: data.timeline?.contractSigned ? 'completed' : 'pending',
        completedAt: timelineDates.Contract_Signed_Date || null,
        currentState: data.timeline?.contractSigned || false
      },
      siteVisitScheduled: {
        status: data.timeline?.siteVisitScheduled ? 'completed' : 'pending',
        completedAt: timelineDates.Site_Visit_Date || null,
        currentState: data.timeline?.siteVisitScheduled || false
      },
      workOrderConfirmed: {
        status: data.timeline?.workOrderConfirmed ? 'completed' : 'pending',
        completedAt: timelineDates.Work_Order_Date || null,
        currentState: data.timeline?.workOrderConfirmed || false
      },
      roofInstallApproved: {
        status: data.timeline?.roofInstallApproved ? 'completed' : 'pending',
        completedAt: timelineDates.Roof_Install_Approval_Date || null,
        currentState: data.timeline?.roofInstallApproved || false
      },
      roofInstallScheduled: {
        status: data.timeline?.roofInstallScheduled ? 'completed' : 'pending',
        completedAt: timelineDates.Install_Schedule_Date || null,
        currentState: data.timeline?.roofInstallScheduled || false
      },
      installDateConfirmedByRoofer: {
        status: data.timeline?.installDateConfirmedByRoofer ? 'completed' : 'pending',
        completedAt: timelineDates.Roofer_Confirmation_Date || null,
        currentState: data.timeline?.installDateConfirmedByRoofer || false
      },
      roofInstallComplete: {
        status: data.timeline?.roofInstallComplete ? 'completed' : 'pending',
        completedAt: timelineDates.Install_Complete_Date || null,
        currentState: data.timeline?.roofInstallComplete || false
      },
      roofInstallFinalized: {
        status: data.timeline?.roofInstallFinalized ? 'completed' : 'pending',
        completedAt: timelineDates.Install_Finalized_Date || null,
        currentState: data.timeline?.roofInstallFinalized || false
      }
    },
    lastMilestone: data.lastMilestone,
    nextStep: data.nextStep,
    propertyAddress: data.propertyAddress
  };

  console.log('Processed project data:', JSON.stringify(processedData, null, 2));
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
      .select(`
        *,
        Contract_Signed_Date,
        Site_Visit_Date,
        Work_Order_Date,
        Roof_Install_Approval_Date,
        Install_Schedule_Date,
        Roofer_Confirmation_Date,
        Install_Complete_Date,
        Install_Finalized_Date
      `)
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    console.log('Parsed project data:', project);

    // Process the project data to handle the timeline structure
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
