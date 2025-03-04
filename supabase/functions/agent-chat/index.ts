
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { messages, projectId } = await req.json()

    // If a project ID is provided, fetch relevant project data
    let projectData = null
    if (projectId) {
      console.log('Fetching project data for ID:', projectId)
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          id, 
          summary, 
          next_step,
          project_track,
          company_id,
          companies(name)
        `)
        .eq('id', projectId)
        .single()

      if (projectError) {
        console.error('Error fetching project:', projectError)
      } else if (project) {
        projectData = project
        console.log('Found project data:', project)
      }
    }

    // Construct system message with project data if available
    const systemMessage = {
      role: 'system',
      content: `You are an intelligent project assistant that helps manage project workflows. 
      ${projectData ? `
        Current project information:
        - Project ID: ${projectData.id}
        - Company: ${projectData.companies?.name || 'Unknown'}
        - Summary: ${projectData.summary || 'No summary available'}
        - Next Step: ${projectData.next_step || 'No next step defined'}
      ` : 'No specific project context is loaded.'}
      
      Answer questions about the current project or workflow processes. If you don't know something, say so clearly.`
    }

    // Add system message to the beginning of the messages array
    const fullMessages = [systemMessage, ...messages]

    console.log('Sending messages to OpenAI:', fullMessages)

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: fullMessages,
        temperature: 0.7,
      }),
    })

    const openAIData = await openAIResponse.json()
    
    if (!openAIResponse.ok) {
      console.error('OpenAI API error:', openAIData)
      throw new Error(`OpenAI API error: ${openAIData.error?.message || 'Unknown error'}`)
    }

    console.log('OpenAI response received')
    return new Response(JSON.stringify({ 
      reply: openAIData.choices[0].message.content,
      projectData: projectData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error in agent-chat function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
