
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
  createMilestoneActionRecord
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
    const projectData = await parseZohoData(rawData)
    console.log('Parsed project data:', projectData)

    // Handle company creation/verification and get the Supabase UUID and default track
    const companyInfo = await handleCompany(supabase, projectData, rawData)
    const companyUuid = companyInfo.id
    const defaultTrackId = companyInfo.defaultTrackId
    
    console.log('Using company UUID:', companyUuid, 'Default track ID:', defaultTrackId)
    
    // Get existing project if any
    const existingProject = await getExistingProject(supabase, projectData.crmId)

    // Determine which project track to use
    const projectTrackId = existingProject?.project_track || defaultTrackId || null
    console.log('Using project track ID:', projectTrackId)

    // Get milestone instructions if next step exists
    const nextStepInstructions = await getMilestoneInstructions(
      supabase,
      projectData.nextStep,
      projectTrackId
    )

    // Get and format the workflow prompt
    const promptTemplate = await getWorkflowPrompt(supabase, !!existingProject)
    const prompt = promptTemplate
      .replace('{{summary}}', existingProject?.summary || '')
      .replace('{{new_data}}', JSON.stringify(projectData))
      .replace('{{current_date}}', new Date().toISOString().split('T')[0])
      .replace('{{next_step_instructions}}', nextStepInstructions || '')

    // Get AI configuration
    const { data: aiConfig, error: aiConfigError } = await supabase
      .from('ai_config')
      .select('provider, model')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const aiProvider = aiConfig?.provider || 'openai';
    const aiModel = aiConfig?.model || 'gpt-4o';
    
    console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);

    // Determine which API key to use based on the provider
    let apiKey;
    if (aiProvider === 'openai') {
      apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
    } else if (aiProvider === 'claude') {
      apiKey = Deno.env.get('CLAUDE_API_KEY') ?? '';
    } else if (aiProvider === 'deepseek') {
      apiKey = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
    }

    if (!apiKey) {
      throw new Error(`API key for ${aiProvider} is not configured`);
    }

    // Generate summary using the configured AI provider
    const summary = await generateSummary(prompt, apiKey, aiProvider, aiModel);

    // Prepare project data using the company UUID from Supabase
    const projectUpdateData = {
      summary,
      next_step: projectData.nextStep,
      last_action_check: new Date().toISOString(),
      company_id: companyUuid,  // Use the UUID we got from handleCompany
      project_track: projectTrackId  // Add project track ID
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

    // Log milestone updates using the new action_records table
    await createMilestoneActionRecord(supabase, existingProject?.id, projectData.timeline)

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary, 
        isNewProject: !existingProject,
        parsedData: projectData,
        nextStepInstructions,
        companyUuid,
        projectTrackId,
        aiProvider,
        aiModel
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
