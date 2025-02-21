
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

interface ProjectData {
  ID: number;
  Last_Milestone: string;
  Next_Step: string;
  Property_Address: string;
  Contract_Signed: string | null;
  Site_Visit_Scheduled: string | null;
  Work_Order_Confirmed: string | null;
  Roof_Install_Approved: string | null;
  Install_Scheduled: string | null;
  Install_Date_Confirmed_by_Roofer: string | null;
  Roof_Install_Complete: string | null;
  Roof_Install_Finalized: string | null;
  Company_ID: number;
}

// Helper function to process the project data with actual dates
const processProjectData = (rawData: ProjectData) => {
  const processedData = {
    id: rawData.ID,
    companyId: rawData.Company_ID,
    lastMilestone: rawData.Last_Milestone,
    nextStep: rawData.Next_Step,
    propertyAddress: rawData.Property_Address,
    timeline: {
      contractSigned: {
        date: rawData.Contract_Signed,
        status: rawData.Contract_Signed ? 'completed' : 'pending'
      },
      siteVisitScheduled: {
        date: rawData.Site_Visit_Scheduled,
        status: rawData.Site_Visit_Scheduled ? 'completed' : 'pending'
      },
      workOrderConfirmed: {
        date: rawData.Work_Order_Confirmed,
        status: rawData.Work_Order_Confirmed ? 'completed' : 'pending'
      },
      roofInstallApproved: {
        date: rawData.Roof_Install_Approved,
        status: rawData.Roof_Install_Approved ? 'completed' : 'pending'
      },
      roofInstallScheduled: {
        date: rawData.Install_Scheduled,
        status: rawData.Install_Scheduled ? 'completed' : 'pending'
      },
      installDateConfirmedByRoofer: {
        date: rawData.Install_Date_Confirmed_by_Roofer,
        status: rawData.Install_Date_Confirmed_by_Roofer ? 'completed' : 'pending'
      },
      roofInstallComplete: {
        date: rawData.Roof_Install_Complete,
        status: rawData.Roof_Install_Complete ? 'completed' : 'pending'
      },
      roofInstallFinalized: {
        date: rawData.Roof_Install_Finalized,
        status: rawData.Roof_Install_Finalized ? 'completed' : 'pending'
      }
    }
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
    const { data: rawProject, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    console.log('Raw project data:', rawProject);

    // Process the project data
    const processedProject = processProjectData(rawProject as ProjectData);

    // Generate the final prompt by replacing placeholders based on prompt type
    let finalPrompt = promptText;

    switch (promptType) {
      case 'summary_generation':
        finalPrompt = finalPrompt.replace('{project_data}', JSON.stringify(processedProject, null, 2));
        break;
      
      case 'summary_update':
        finalPrompt = finalPrompt
          .replace('{current_summary}', rawProject.summary || '')
          .replace('{new_data}', JSON.stringify(processedProject, null, 2));
        break;
      
      case 'action_detection':
        const summaryForAction = previousResults?.find(r => r.type === 'summary_generation')?.output || rawProject.summary;
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
