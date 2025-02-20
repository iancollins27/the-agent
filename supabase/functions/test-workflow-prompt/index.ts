
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

    console.log('Raw project data:', project);

    // Create processed data structure without any boolean conversion
    const processedData = {
      id: project.ID,
      companyId: project.Company_ID,
      lastMilestone: project.Last_Milestone,
      nextStep: project.Next_Step,
      propertyAddress: project.Property_Address,
      timeline: {
        contractSigned: {
          date: project.Contract_Signed,
          status: project.Contract_Signed ? 'completed' : 'pending'
        },
        siteVisitScheduled: {
          date: project.Site_Visit_Scheduled,
          status: project.Site_Visit_Scheduled ? 'completed' : 'pending'
        },
        workOrderConfirmed: {
          date: project.Work_Order_Confirmed,
          status: project.Work_Order_Confirmed ? 'completed' : 'pending'
        },
        roofInstallApproved: {
          date: project.Roof_Install_Approved,
          status: project.Roof_Install_Approved ? 'completed' : 'pending'
        },
        roofInstallScheduled: {
          date: project.Install_Scheduled,
          status: project.Install_Scheduled ? 'completed' : 'pending'
        },
        installDateConfirmedByRoofer: {
          date: project.Install_Date_Confirmed_by_Roofer,
          status: project.Install_Date_Confirmed_by_Roofer ? 'completed' : 'pending'
        },
        roofInstallComplete: {
          date: project.Roof_Install_Complete,
          status: project.Roof_Install_Complete ? 'completed' : 'pending'
        },
        roofInstallFinalized: {
          date: project.Roof_Install_Finalized,
          status: project.Roof_Install_Finalized ? 'completed' : 'pending'
        }
      }
    };

    console.log('Processed project data:', JSON.stringify(processedData, null, 2));

    // Generate the final prompt by replacing placeholders based on prompt type
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
        model: 'gpt-4o-mini',
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
