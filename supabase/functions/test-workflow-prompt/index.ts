
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectData {
  ID: number;
  Company_ID: number;
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, promptType, promptText, previousResults } = await req.json();

    console.log(`Processing ${promptType} for project ${projectId}`);

    // Fetch project data using direct fetch to Supabase REST API
    const projectResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/rest/v1/projects?id=eq.${projectId}&select=*`,
      {
        headers: {
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
      }
    );

    if (!projectResponse.ok) {
      throw new Error(`Failed to fetch project: ${projectResponse.statusText}`);
    }

    const [project] = await projectResponse.json();
    
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Log the raw data exactly as we receive it
    console.log('RAW PROJECT DATA:', JSON.stringify(project, null, 2));

    // Create processed data structure preserving all original values
    const processedData = {
      id: project.ID,
      companyId: project.Company_ID,
      lastMilestone: project.Last_Milestone,
      nextStep: project.Next_Step,
      propertyAddress: project.Property_Address,
      timeline: {
        contractSigned: project.Contract_Signed,
        siteVisitScheduled: project.Site_Visit_Scheduled,
        workOrderConfirmed: project.Work_Order_Confirmed,
        roofInstallApproved: project.Roof_Install_Approved,
        roofInstallScheduled: project.Install_Scheduled,
        installDateConfirmedByRoofer: project.Install_Date_Confirmed_by_Roofer,
        roofInstallComplete: project.Roof_Install_Complete,
        roofInstallFinalized: project.Roof_Install_Finalized
      }
    };

    // Log the processed data to verify no transformations occurred
    console.log('PROCESSED DATA (before prompt):', JSON.stringify(processedData, null, 2));

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

    // Log the final prompt to verify data is still intact
    console.log('FINAL PROMPT:', finalPrompt);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
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
