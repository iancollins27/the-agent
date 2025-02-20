import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://deno.land/x/supabase@1.3.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Adjust the timeline type definitions to store date/time strings (or null).
interface ParsedProjectData {
  id: number
  companyId: number
  lastMilestone: string
  nextStep: string
  propertyAddress: string
  timeline: {
    contractSigned: string | null
    siteVisitScheduled: string | null
    workOrderConfirmed: string | null
    roofInstallApproved: string | null
    roofInstallScheduled: string | null
    installDateConfirmedByRoofer: string | null
    roofInstallComplete: string | null
    roofInstallFinalized: string | null
  }
}

function parseZohoData(rawData: any): ParsedProjectData {
  console.log('Parsing data:', rawData)

  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Invalid data received from Zoho')
  }

  // Handle both direct ID field and nested ID field cases
  const idValue = rawData.ID || (rawData.rawData && rawData.rawData.ID)
  const companyId = rawData.Company_ID || (rawData.rawData && rawData.rawData.Company_ID)

  if (!idValue) {
    throw new Error('Project ID is missing in the Zoho data')
  }

  if (!companyId) {
    throw new Error('Company ID is missing in the Zoho data')
  }

  const id = parseInt(idValue)
  if (isNaN(id)) {
    throw new Error('Invalid project ID format')
  }

  // Handle both direct fields and nested rawData fields
  const data = rawData.rawData || rawData

  return {
    id,
    companyId: parseInt(companyId),
    lastMilestone: data.Last_Milestone || '',
    nextStep: data.Next_Step || '',
    propertyAddress: data.Property_Address || '',
    // Store Zoho dates as strings (or null) instead of booleans.
    timeline: {
      contractSigned: data.Contract_Signed || null,
      siteVisitScheduled: data.Site_Visit_Scheduled || null,
      workOrderConfirmed: data.Work_Order_Confirmed || null,
      roofInstallApproved: data.Roof_Install_Approved || null,
      roofInstallScheduled: data.Install_Scheduled || null,
      installDateConfirmedByRoofer: data.Install_Date_Confirmed_by_Roofer || null,
      roofInstallComplete: data.Roof_Install_Complete || null,
      roofInstallFinalized: data.Roof_Install_Finalized || null,
    },
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
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

    // Check if project already exists
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
    let prompt: string
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
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that generates concise project summaries focusing on timeline milestones.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    const openAIData = await openAIResponse.json()
    const summary = openAIData.choices[0].message.content

    // Create or update the project in Supabase
    if (existingProject) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          summary,
          last_action_check: new Date().toISOString(),
          company_id: projectData.companyId, // Update company_id as well
        })
        .eq('id', projectData.id)

      if (updateError) throw updateError
    } else {
      const { error: createError } = await supabase
        .from('projects')
        .insert([
          {
            id: projectData.id,
            summary,
            last_action_check: new Date().toISOString(),
            company_id: projectData.companyId, // Set company_id for new project
          },
        ])

      if (createError) throw createError
    }

    // Log any milestone transitions
    const { timeline } = projectData
    // Example of how you might log completed milestones if needed:
    // A milestone is considered completed if there's a non-null date string
    const milestones = Object.entries(timeline)
      .filter(([_, value]) => value !== null)
      .map(([milestone]) => milestone)

    if (milestones.length > 0) {
      await supabase.from('action_logs').insert({
        project_id: projectData.id,
        action_type: 'milestone_update',
        action_description: `Project milestones updated: ${milestones.join(', ')}`,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        isNewProject: !existingProject,
        parsedData: projectData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
