
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './utils/cors.ts'
import { toolRegistry } from './tools/toolRegistry.ts'
import { toolExecutor } from './tools/toolExecutor.ts'
import { logObservability } from './observability.ts'
import { createContactAuthenticatedClient, getContactProjects } from './utils/contactAuth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the request body
    const body = await req.json()
    const { messages, projectId, projectData, customPrompt, availableTools = [], userId, contact_id } = body
    
    // ADD DIAGNOSTIC LOGGING
    console.log('=== DIAGNOSTIC: Agent-chat received parameters ===');
    console.log('Received userId:', userId);
    console.log('Received contact_id:', contact_id);
    console.log('Full request body keys:', Object.keys(body));
    console.log('=== END DIAGNOSTIC ===');
    
    console.log('Agent-chat request received:', {
      hasMessages: messages?.length > 0,
      projectId,
      userId,
      contact_id,
      availableTools: availableTools?.length || 0
    })
    
    // Determine authentication context
    let userProfile = null
    let companyId = null
    let authContext = 'anonymous'
    let authenticatedContact = null
    let supabase = null
    
    // Handle different authentication types
    if (contact_id) {
      // SMS/Channel authentication - contact_id provided directly
      console.log(`Processing homeowner request with contact_id: ${contact_id}`)
      
      // Create contact-authenticated client (uses anon key + contact context for RLS)
      supabase = createContactAuthenticatedClient(supabaseUrl, supabaseAnonKey, contact_id)
      
      try {
        console.log(`Attempting to fetch contact details for: ${contact_id}`)
        
        // Fetch contact details using RLS-enabled client
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('id, full_name, role, email, phone_number, company_id')
          .eq('id', contact_id)
          .single()
        
        if (contactError) {
          console.error(`Contact lookup failed for ${contact_id}:`, {
            error: contactError,
            message: contactError.message,
            details: contactError.details,
            hint: contactError.hint
          })
          return new Response(JSON.stringify({ 
            error: 'Contact authentication failed',
            details: contactError.message,
            contact_id 
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        if (!contact) {
          console.error(`No contact found for ID: ${contact_id}`)
          return new Response(JSON.stringify({ 
            error: 'Contact not found',
            contact_id 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        console.log(`Contact authenticated successfully:`, {
          id: contact.id,
          name: contact.full_name,
          role: contact.role,
          company_id: contact.company_id
        })
        
        authenticatedContact = contact
        userProfile = contact
        companyId = contact.company_id
        authContext = 'contact'
        
        // Role-agnostic: fetch projects for any contact type
        console.log(`Fetching projects for contact ${contact.id} (role: ${contact.role})`)
        
        try {
          // Get contact's projects using security definer function
          const contactProjects = await getContactProjects(supabase, contact.id)
          
          console.log(`Project fetch result:`, {
            projectCount: contactProjects?.length || 0,
            projects: contactProjects
          })
          
          // Determine the project context (use first project if available)
          const projectData = contactProjects && contactProjects.length > 0 ? contactProjects[0] : null
          
          // Build role-appropriate system prompt
          const rolePromptMap: Record<string, string> = {
            'HO': `You are speaking with ${contact.full_name}, a homeowner.`,
            'homeowner': `You are speaking with ${contact.full_name}, a homeowner.`,
            'Roofer': `You are speaking with ${contact.full_name}, a roofing contractor.`,
            'BidList Project Manager': `You are speaking with ${contact.full_name}, a project manager.`,
            'Solar': `You are speaking with ${contact.full_name}, a solar contractor.`,
            'Solar Ops': `You are speaking with ${contact.full_name}, from solar operations.`,
            'Solar Sales Rep': `You are speaking with ${contact.full_name}, a solar sales representative.`
          }
          
          const roleContext = rolePromptMap[contact.role] || `You are speaking with ${contact.full_name} (${contact.role}).`
          
          let projectContext = ''
          if (projectData) {
            projectContext = `
Their project: ${projectData.project_name || projectData.address || 'Project'}
Project status: ${projectData.project_status || 'Active'}
You can help them with updates about their project.

IMPORTANT: Use tools like data_fetch with project_id: ${projectData.id} to get current project information.`
          } else {
            projectContext = `
No specific project is currently selected. You can help them find their projects or answer general questions.`
          }
          
          // Set up the context for tool execution
          const toolContext = {
            supabase,
            userProfile: contact,
            companyId: projectData?.company_id || contact.company_id,
            projectId: projectData?.id,
            projectData: projectData,
            authContext: 'contact',
            authenticatedContact: contact,
            req
          }
          
          // Enhanced system prompt for any contact role
          const contactPrompt = `${customPrompt || 'You are a helpful AI assistant.'}

CONTACT CONTEXT:
${roleContext}
${projectContext}

Available tools: ${toolRegistry.getAllTools().filter(t => ['data_fetch', 'create_action_record', 'identify_project'].includes(t.name)).map(t => t.name).join(', ')}`

          // Filter tools to appropriate ones for contacts
          const contactTools = toolRegistry.getAllTools().filter(tool => 
            ['data_fetch', 'create_action_record', 'identify_project'].includes(tool.name)
          )
          
          const toolDefinitions = contactTools.map(tool => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.schema
            }
          }))

          // Prepare messages for OpenAI
          const openAIMessages = [
            { role: "system", content: contactPrompt },
            ...messages
          ]

          console.log(`Sending OpenAI request for contact (${contact.role}) with ${toolDefinitions.length} tools`)

          // Call OpenAI
          const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-5-2025-08-07',
              messages: openAIMessages,
              tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
              tool_choice: toolDefinitions.length > 0 ? "auto" : undefined,
              max_completion_tokens: 2000
            })
          })

          if (!openAIResponse.ok) {
            const errorData = await openAIResponse.text()
            console.error('OpenAI API error for contact:', errorData)
            throw new Error(`OpenAI API error: ${openAIResponse.status} ${errorData}`)
          }

          const openAIData = await openAIResponse.json()
          const assistantMessage = openAIData.choices[0].message

          // Handle tool calls if present
          if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            console.log(`Processing ${assistantMessage.tool_calls.length} tool calls for contact`)
            
            const toolResponses = []
            
            for (const toolCall of assistantMessage.tool_calls) {
              console.log(`Executing tool ${toolCall.function.name} for contact with args:`, toolCall.function.arguments)
              
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
                
                console.log(`Tool ${toolCall.function.name} execution completed for contact`)
              } catch (error) {
                console.error(`Tool execution error for contact ${toolCall.function.name}:`, {
                  error: error.message,
                  stack: error.stack,
                  args: toolCall.function.arguments
                })
                toolResponses.push({
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    status: "error",
                    error: error.message
                  })
                })
              }
            }
            
            assistantMessage.tool_responses = toolResponses
          }

          // Log observability data for contact
          try {
            await logObservability({
              supabase,
              projectId: projectData?.id,
              userProfile: contact,
              companyId: projectData?.company_id || contact.company_id,
              messages: openAIMessages,
              response: assistantMessage,
              toolCalls: assistantMessage.tool_calls || [],
              model: 'gpt-5-2025-08-07',
              usage: openAIData.usage
            })
          } catch (obsError) {
            console.error('Observability logging failed for contact:', obsError)
            // Don't fail the request for observability errors
          }

          return new Response(JSON.stringify({
            choices: [{
              message: assistantMessage
            }],
            usage: openAIData.usage
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (projectError) {
          console.error(`Error processing contact ${contact.id}:`, {
            error: projectError.message,
            stack: projectError.stack,
            contact_id: contact.id
          })
          return new Response(JSON.stringify({ 
            error: 'Error processing contact request',
            details: projectError.message,
            contact_id: contact.id 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      } catch (authError) {
        console.error(`Authentication error for contact ${contact_id}:`, {
          error: authError.message,
          stack: authError.stack,
          contact_id
        })
        return new Response(JSON.stringify({ 
          error: 'Contact authentication failed',
          details: authError.message,
          contact_id 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else if (userId) {
      // Web authentication - userId provided
      console.log(`Processing web request with userId: ${userId}`)
      
      // Use anon key for web users (they should be authenticated via auth.users)
      supabase = createClient(supabaseUrl, supabaseAnonKey)
      
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, company_id, role, permission')
        .eq('id', userId)
        .limit(1)
      
      if (profiles && profiles.length > 0 && !profileError) {
        userProfile = profiles[0]
        companyId = profiles[0].company_id
        authContext = 'web'
        console.log(`Web user authenticated - user: ${profiles[0].id}, company: ${companyId}`)
      } else {
        console.error(`Failed to authenticate web user: ${profileError?.message || 'No profile found'}`)
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

    // Continue with regular flow for web users
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
      companyId,
      projectId,
      projectData,
      authContext,
      authenticatedContact,
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
        model: 'gpt-5-2025-08-07',
        messages: openAIMessages,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        tool_choice: toolDefinitions.length > 0 ? "auto" : undefined,
        max_completion_tokens: 2000
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
    try {
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
    } catch (obsError) {
      console.error('Observability logging failed:', obsError)
      // Don't fail the request for observability errors
    }

    return new Response(JSON.stringify({
      choices: [{
        message: assistantMessage
      }],
      usage: openAIData.usage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in agent-chat:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
