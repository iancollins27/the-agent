
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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

    const { projectData, updateType } = await req.json()

    // Get the appropriate prompt based on the update type
    const { data: promptData } = await supabase
      .from('workflow_prompts')
      .select('prompt_text')
      .eq('type', updateType === 'new' ? 'summary_generation' : 'summary_update')
      .single()

    if (!promptData) {
      throw new Error('Prompt not found')
    }

    // Format the prompt with the project data
    let prompt = promptData.prompt_text.replace('{project_data}', JSON.stringify(projectData))

    if (updateType !== 'new') {
      const { data: existingProject } = await supabase
        .from('projects')
        .select('summary')
        .eq('id', projectData.id)
        .single()

      if (existingProject?.summary) {
        prompt = promptData.prompt_text
          .replace('{current_summary}', existingProject.summary)
          .replace('{new_data}', JSON.stringify(projectData))
      }
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

    // Update the project summary in the database
    const { error: updateError } = await supabase
      .from('projects')
      .update({ summary })
      .eq('id', projectData.id)

    if (updateError) throw updateError

    // Check if any action is needed
    const { data: actionPrompt } = await supabase
      .from('workflow_prompts')
      .select('prompt_text')
      .eq('type', 'action_detection')
      .single()

    const actionCheckPrompt = actionPrompt.prompt_text
      .replace('{summary}', summary)
      .replace('{track_requirements}', projectData.track_requirements || '')
      .replace('{last_communication}', projectData.last_communication || '')

    const actionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a project manager assistant that determines if actions are needed.' },
          { role: 'user', content: actionCheckPrompt }
        ],
      }),
    })

    const actionData = await actionResponse.json()
    const actionNeeded = actionData.choices[0].message.content

    if (actionNeeded.toLowerCase().includes('action needed')) {
      // Log the action
      await supabase
        .from('action_logs')
        .insert({
          project_id: projectData.id,
          action_type: 'follow_up',
          action_description: actionNeeded
        })
    }

    return new Response(
      JSON.stringify({ success: true, summary, actionNeeded }),
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
