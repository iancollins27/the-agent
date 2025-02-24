
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { parseZohoData } from './parser.ts'
import { 
  handleCompany, 
  getExistingProject, 
  getMilestoneInstructions,
  getWorkflowPrompt,
  updateProject,
  createProject,
  logMilestoneUpdates
} from './database.ts'
import { generateSummary } from './ai.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Handle company creation/verification
    await handleCompany(supabase, projectData, rawData)
    
    // Get existing project if any
    const existingProject = await getExistingProject(supabase, projectData.crmId)

    // Get milestone instructions if next step exists
    const nextStepInstructions = await getMilestoneInstructions(
      supabase,
      projectData.nextStep,
      existingProject?.project_track
    )

    // Get and format the workflow prompt
    const promptTemplate = await getWorkflowPrompt(supabase, !!existingProject)
    const prompt = promptTemplate
      .replace('{{summary}}', existingProject?.summary || '')
      .replace('{{new_data}}', JSON.stringify(projectData))
      .replace('{{current_date}}', new Date().toISOString().split('T')[0])
      .replace('{{next_step_instructions}}', nextStepInstructions || '')

    // Generate summary using OpenAI
    const summary = await generateSummary(prompt, Deno.env.get('OPENAI_API_KEY') ?? '')

    // Prepare project data
    const projectUpdateData = {
      summary,
      next_step: projectData.nextStep,
      last_action_check: new Date().toISOString(),
      company_id: projectData.companyId
    }

    // Update or create project
    if (existingProject) {
      await updateProject(supabase, existingProject.id, projectUpdateData)
    } else {
      await createProject(supabase, {
        ...projectUpdateData,
        crm_id: projectData.crmId
      })
    }

    // Log milestone updates
    await logMilestoneUpdates(supabase, existingProject?.id, projectData.timeline)

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary, 
        isNewProject: !existingProject,
        parsedData: projectData,
        nextStepInstructions
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
