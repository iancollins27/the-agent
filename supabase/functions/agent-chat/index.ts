
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './utils/cors.ts'
import { toolRegistry } from './tools/toolRegistry.ts'
import { toolExecutor } from './tools/toolExecutor.ts'
import { logObservability } from './observability.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get the request body
    const body = await req.json()
    const { messages, projectId, projectData, customPrompt, availableTools = [], userId, contact_id } = body
    
    // Determine authentication context
    let userProfile = null
    let companyId = null
    let authContext = 'anonymous'
    
    // Handle different authentication types
    if (contact_id) {
      // SMS/Channel authentication - contact_id provided directly
      console.log(`Request received with contact_id: ${contact_id}`)
      
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id, full_name, role, email, phone_number, company_id')
        .eq('id', contact_id)
        .single()
      
      if (contact && !contactError) {
        userProfile = contact
        companyId = contact.company_id
        authContext = 'sms'
        
        // For homeowners, company_id might be null - this is expected
        if (contact.role === 'homeowner' || contact.role === 'HO') {
          console.log(`SMS user authenticated - contact: ${contact.id}, company: ${companyId || 'null (homeowner)'}, role: ${contact.role}`)
        } else {
          console.log(`SMS user authenticated - contact: ${contact.id}, company: ${companyId}`)
        }
      } else {
        console.error(`Failed to authenticate contact: ${contactError?.message}`)
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else if (userId) {
      // Web authentication - userId provided
      console.log(`Request received with userId: ${userId}`)
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, company_id, role, permission')
        .eq('id', userId)
        .single()
      
      if (profile && !profileError) {
        userProfile = profile
        companyId = profile.company_id
        authContext = 'web'
        console.log(`Web user authenticated - user: ${profile.id}, company: ${companyId}`)
      } else {
        console.error(`Failed to authenticate user: ${profileError?.message}`)
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      console.error('No authentication provided')
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Filter tools based on availability
    const registeredTools = toolRegistry.getAllTools()
    const filteredTools = availableTools.length > 0 
      ? registeredTools.filter(tool => availableTools.includes(tool.name))
      : registeredTools

    console.log(`Filtered ${filteredTools.length} tools from ${registeredTools.length} available`)
    console.log(`Available tools for this request: [${filteredTools.map(t => `"${t.name}"`).join(',')}]`)

    // Convert tools to OpenAI format
    const toolDefinitions = filteredTools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }
    }))

    console.log(`Filtered tool definitions: [${toolDefinitions.map(t => `"${t.function.name}"`).join(',')}]`)

    // Prepare the context for tool execution
    const toolContext = {
      supabase,
      userProfile,
      companyId, // For homeowners, this might be null - tools should handle this
      projectId,
      projectData,
      authContext,
      req
    }

    // Enhanced system prompt for better tool usage
    const enhancedSystemPrompt = `${customPrompt || 'You are a helpful AI assistant.'}

IMPORTANT TOOL USAGE RULES:
1. You MUST use the identify_project tool before using data_fetch or other project-related tools
2. Always use the exact project_id returned by identify_project for subsequent tool calls
3. For homeowners, identify_project will automatically find their projects - no search query needed
4. For company users, provide a search query to identify_project

Available tools: ${filteredTools.map(t => t.name).join(', ')}`

    // Prepare messages for OpenAI
    const openAIMessages = [
      { role: "system", content: enhancedSystemPrompt },
      ...messages
    ]

    console.log(`Sending OpenAI request with tools: [${toolDefinitions.map(t => `"${t.function.name}"`).join(',')}]`)

    // Call OpenAI
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openAIMessages,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        tool_choice: toolDefinitions.length > 0 ? "auto" : undefined,
        temperature: 0.7
      })
    })

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.text()
      console.error('OpenAI API error:', errorData)
      throw new Error(`OpenAI API error: ${openAIResponse.status} ${errorData}`)
    }

    const openAIData = await openAIResponse.json()
    const assistantMessage = openAIData.choices[0].message

    // Handle tool calls if present
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`Processing ${assistantMessage.tool_calls.length} tool calls`)
      
      const toolResponses = []
      
      for (const toolCall of assistantMessage.tool_calls) {
        console.log(`Executing tool ${toolCall.function.name} with args: ${toolCall.function.arguments}`)
        
        // Enhanced security context logging for homeowners
        if (userProfile?.role === 'homeowner' || userProfile?.role === 'HO') {
          console.log(`Security context for tool execution - homeowner: ${userProfile.id}, company: ${companyId || 'none'}`)
        } else {
          console.log(`Security context for tool execution - user: ${userProfile?.id}, company: ${companyId || 'none'}`)
        }
        
        try {
          const args = JSON.parse(toolCall.function.arguments)
          const result = await toolExecutor.executeTool(
            toolCall.function.name,
            args,
            toolContext
          )
          
          toolResponses.push({
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          })
          
          console.log(`Tool ${toolCall.function.name} execution completed`)
        } catch (error) {
          console.error(`Tool execution error for ${toolCall.function.name}:`, error)
          toolResponses.push({
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              status: "error",
              error: error.message
            })
          })
        }
      }
      
      // Add tool responses to the message
      assistantMessage.tool_responses = toolResponses
    }

    // Log observability data
    await logObservability({
      supabase,
      projectId,
      userProfile,
      companyId,
      messages: openAIMessages,
      response: assistantMessage,
      toolCalls: assistantMessage.tool_calls || [],
      model: 'gpt-4o',
      usage: openAIData.usage
    })

    return new Response(JSON.stringify({
      choices: [{
        message: assistantMessage
      }],
      usage: openAIData.usage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in agent-chat:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred processing your request'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
