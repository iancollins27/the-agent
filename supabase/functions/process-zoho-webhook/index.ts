
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParsedProjectData {
  id: number;
  lastMilestone: string;
  nextStep: string;
  propertyAddress: string;
  timeline: {
    contractSigned: boolean;
    siteVisitScheduled: boolean;
    workOrderConfirmed: boolean;
    roofInstallApproved: boolean;
    roofInstallScheduled: boolean;
    installDateConfirmedByRoofer: boolean;
    roofInstallComplete: boolean;
    roofInstallFinalized: boolean;
  };
}

function parseZohoData(rawData: any): ParsedProjectData {
  console.log('Parsing data:', rawData); // Additional logging

  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Invalid data received from Zoho');
  }

  // Handle both direct ID field and nested ID field cases
  const idValue = rawData.ID || (rawData.rawData && rawData.rawData.ID);
  
  if (!idValue) {
    throw new Error('Project ID is missing in the Zoho data');
  }

  const id = parseInt(idValue);
  if (isNaN(id)) {
    throw new Error('Invalid project ID format');
  }

  // Handle both direct fields and nested rawData fields
  const data = rawData.rawData || rawData;

  return {
    id,
    lastMilestone: data.Last_Milestone || '',
    nextStep: data.Next_Step || '',
    propertyAddress: data.Property_Address || '',
    timeline: {
      contractSigned: Boolean(data.Contract_Signed),
      siteVisitScheduled: Boolean(data.Site_Visit_Scheduled),
      workOrderConfirmed: Boolean(data.Work_Order_Confirmed),
      roofInstallApproved: Boolean(data.Roof_Install_Approved),
      roofInstallScheduled: Boolean(data.Install_Scheduled),
      installDateConfirmedByRoofer: Boolean(data.Install_Date_Confirmed_by_Roofer),
      roofInstallComplete: Boolean(data.Roof_Install_Complete),
      roofInstallFinalized: Boolean(data.Roof_Install_Finalized)
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Log the raw request body for debugging
    const requestBody = await req.json()
    console.log('Raw webhook payload:', requestBody)
    
    // Handle both cases where data might be nested or not
    const rawData = requestBody.rawData || requestBody
    const projectData = parseZohoData(rawData)
    console.log('Parsed project data:', projectData)
    
    // Check if project exists
    const { data: existingProject } = await supabase
      .from('projects')
      .select('id, summary')
      .eq('id', projectData.id)
      .maybeSingle()

    // Get the appropriate prompt based on whether project exists
    const { data: promptData } = await supabase
      .from('workflow_prompts')
      .select('prompt_text')
      .eq('type', existingProject ? 'summary_update' : 'summary_generation')
      .single()

    if (!promptData) {
      throw new Error('Prompt not found')
    }

    // Format the prompt based on whether it's a new or existing project
    let prompt
    if (existingProject) {
      prompt = promptData.prompt_text
        .replace('{current_summary}', existingProject.summary || '')
        .replace('{new_data}', JSON.stringify(projectData))
    } else {
      prompt = promptData.prompt_text
        .replace('{project_data}', JSON.stringify(projectData))
    }

    // Call OpenAI to generate or update summary
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates concise project summaries focusing on timeline milestones.' },
          { role: 'user', content: prompt }
        ],
      }),
    })

    const openAIData = await openAIResponse.json()
    const summary = openAIData.choices[0].message.content

    // Create or update the project
    if (existingProject) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          summary,
          last_action_check: new Date().toISOString()
        })
        .eq('id', projectData.id)
      
      if (updateError) throw updateError
    } else {
      const { error: createError } = await supabase
        .from('projects')
        .insert([{ 
          id: projectData.id,
          summary,
          last_action_check: new Date().toISOString()
        }])
      
      if (createError) throw createError
    }

    // Log any milestone transitions
    const { timeline } = projectData
    const milestones = Object.entries(timeline)
      .filter(([_, completed]) => completed)
      .map(([milestone]) => milestone)

    if (milestones.length > 0) {
      await supabase
        .from('action_logs')
        .insert({
          project_id: projectData.id,
          action_type: 'milestone_update',
          action_description: `Project milestones updated: ${milestones.join(', ')}`
        })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary, 
        isNewProject: !existingProject,
        parsedData: projectData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
