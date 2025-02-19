
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParsedProjectData {
  id: string;
  status: string;
  lastUpdated: string;
  nextStep: string;
  propertyAddress: string;
  installScheduled: boolean;
  estimatedInstallDate: string;
  lastActivityDate: string;
  roofInstallComplete: boolean;
  contractSigned: boolean;
  priceToCustomer: number;
  contractorCost: number;
  bidListFee: number;
  contractorNotes: string;
  chatGPTReasoning: string;
  chatGPTFollowUpNeeded: boolean;
}

function parseZohoData(rawData: any): ParsedProjectData {
  return {
    id: rawData.ID || '',
    status: rawData.Status || '',
    lastUpdated: rawData.Last_Updated || '',
    nextStep: rawData.Next_Step || '',
    propertyAddress: rawData.Property_Address || '',
    installScheduled: Boolean(rawData.Install_Scheduled),
    estimatedInstallDate: rawData.Estimated_Install_Date || '',
    lastActivityDate: rawData.Last_Activity_Date || '',
    roofInstallComplete: Boolean(rawData.Roof_Install_Complete),
    contractSigned: Boolean(rawData.Contract_Signed),
    priceToCustomer: Number(rawData.Price_to_Customer) || 0,
    contractorCost: Number(rawData.Contractor_Cost) || 0,
    bidListFee: Number(rawData.BidList_Fee) || 0,
    contractorNotes: rawData.Contractor_performance_notes || '',
    chatGPTReasoning: rawData.ChatGPT_Reasoning || '',
    chatGPTFollowUpNeeded: Boolean(rawData.ChatGPT_Follow_up_Needed)
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
          { role: 'system', content: 'You are a helpful assistant that generates concise project summaries.' },
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
          company_id: null, // You might want to add logic to determine company_id
          last_action_check: new Date().toISOString()
        }])
      
      if (createError) throw createError
    }

    // Check if any action is needed
    if (projectData.chatGPTFollowUpNeeded) {
      await supabase
        .from('action_logs')
        .insert({
          project_id: projectData.id,
          action_type: 'follow_up',
          action_description: projectData.chatGPTReasoning || 'Follow-up needed based on Zoho update'
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
