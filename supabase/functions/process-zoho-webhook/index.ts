
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParsedProjectData {
  id: string;
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
  return {
    id: rawData.ID || '',
    lastMilestone: rawData.Last_Milestone || '',
    nextStep: rawData.Next_Step || '',
    propertyAddress: rawData.Property_Address || '',
    timeline: {
      contractSigned: Boolean(rawData.Contract_Signed),
      siteVisitScheduled: Boolean(rawData.Site_Visit_Scheduled),
      workOrderConfirmed: Boolean(rawData.Work_Order_Confirmed),
      roofInstallApproved: Boolean(rawData.Roof_Install_Approved),
      roofInstallScheduled: Boolean(rawData.Install_Scheduled),
      installDateConfirmedByRoofer: Boolean(rawData.Install_Date_Confirmed_by_Roofer),
      roofInstallComplete: Boolean(rawData.Roof_Install_Complete),
      roofInstallFinalized: Boolean(rawData.Roof_Install_Finalized)
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

    const { rawData } = await req.json()
    const projectData = parseZohoData(rawData)
    
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
