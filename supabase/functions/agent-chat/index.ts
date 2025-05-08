import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { getToolDefinitions } from './tools/toolRegistry.ts'
import { executeToolCall } from './tools/toolExecutor.ts'
import { createMCPContext, extractToolCallsFromOpenAI, addToolResult } from './mcp.ts'
import { getChatSystemPrompt } from './mcp-system-prompts.ts'

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

    const { messages, projectId, streaming = false } = await req.json()
    
    // Log the incoming request
    console.log(`Agent chat request received: ${messages.length} messages${projectId ? `, project ID: ${projectId}` : ''}`)
    
    // Get chatbot configuration
    const { data: configData } = await supabase
      .from('chatbot_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .catch(err => {
        console.log('Error fetching chatbot config:', err)
        return { data: null }
      })
    
    const botConfig = configData || {
      system_prompt: null, // We'll use our default MCP system prompt
      model: 'gpt-4o-mini',
      temperature: 0.7,
      search_project_data: true
    }
    
    console.log('Using bot configuration:', botConfig)

    // Get AI configuration
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('provider, model')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .catch(err => {
        console.log('Error fetching AI config:', err)
        return { data: null }
      })
    
    const aiProvider = aiConfig?.provider || 'openai'
    const aiModel = botConfig.model || 'gpt-4o-mini'
    
    // Get user profile if applicable
    const authHeader = req.headers.get('Authorization')
    let userProfile = null
    let companyId = null
    
    if (authHeader) {
      try {
        const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
        if (userData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*, profile_associated_company')
            .eq('id', userData.user.id)
            .single()
          
          userProfile = profile
          companyId = profile?.profile_associated_company
          console.log(`User authenticated: ${userData.user.email}, company ID: ${companyId}`)
        }
      } catch (authError) {
        console.log('Error fetching user profile:', authError)
      }
    }

    // Get the latest user message
    const latestUserMessage = messages.length > 0 && messages[messages.length - 1].role === 'user' 
      ? messages[messages.length - 1].content 
      : ''
    
    // Initialize context data
    let contextData: any = { companyId }
    let projectData = null
    
    // If we have a project ID, load project data
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
          crm_id,
          Project_status,
          companies(name)
        `)
        .eq('id', projectId)
        .single()

      if (projectError) {
        console.error('Error fetching project by ID:', projectError)
      } else if (project) {
        projectData = project
        companyId = project.company_id
        contextData.projectData = projectData
        console.log('Found project data by ID:', project)
      }
    }

    // Create a prompt run record to track this conversation
    let promptRunId: string | null = null
    try {
      const { data: promptRun, error: logError } = await supabase
        .from('prompt_runs')
        .insert({
          project_id: projectData?.id || null,
          prompt_input: JSON.stringify({
            system: "Chat conversation",
            user: latestUserMessage
          }),
          status: 'PENDING'
        })
        .select()
        .single()
        
      if (logError) {
        console.error('Error logging chat prompt run:', logError)
      } else {
        promptRunId = promptRun.id
        console.log('Created prompt run with ID:', promptRunId)
      }
    } catch (error) {
      console.error('Error creating prompt run:', error)
    }

    // Get API key for the selected provider
    let apiKey
    if (aiProvider === 'openai') {
      apiKey = Deno.env.get('OPENAI_API_KEY')
    } else if (aiProvider === 'claude') {
      apiKey = Deno.env.get('CLAUDE_API_KEY')
    } else {
      apiKey = Deno.env.get('OPENAI_API_KEY')
    }

    if (!apiKey) {
      throw new Error(`API key for ${aiProvider} is not configured`)
    }

    // Set up MCP with tools
    const tools = getToolDefinitions()
    const toolNames = tools.map(t => t.function.name)
    
    // Create the system prompt
    const systemPrompt = getChatSystemPrompt(toolNames, contextData)
    
    // Get all user messages
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content)
    const latestPrompt = userMessages.length > 0 ? userMessages[userMessages.length - 1] : ''
    
    // Create MCP context
    let mcpContext = createMCPContext(systemPrompt, latestPrompt, tools)
    
    // Add previous messages to the context (skip the first user message which is in createMCPContext)
    // And start from the second message in the conversation
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role !== 'system') { // Skip system messages as we use our own
        mcpContext.messages.push({
          role: messages[i].role,
          content: messages[i].content
        })
      }
    }
    
    // If streaming is requested, set up streaming response
    if (streaming) {
      // This will be implemented later for streaming
      // For now, fallback to non-streaming
      console.log('Streaming requested but not yet implemented, falling back to non-streaming')
    }
    
    // Process MCP conversation
    let finalAnswer = ''
    let actionRecordId = null
    const MAX_ITERATIONS = 5 // Prevent infinite loops
    let iterationCount = 0
    let processedToolCallIds = new Set() // Track processed tool call IDs
    
    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++
      console.log(`Starting MCP iteration ${iterationCount}`)

      try {
        // Make API request to OpenAI
        const payload = {
          model: aiModel,
          messages: mcpContext.messages,
          temperature: botConfig.temperature || 0.7
        }
        
        if (mcpContext.tools && mcpContext.tools.length > 0) {
          // @ts-ignore - Add tools to payload if available
          payload.tools = mcpContext.tools
          // @ts-ignore - Set tool_choice to auto if tools are available
          payload.tool_choice = "auto"
        }
        
        console.log(`Sending AI request for iteration ${iterationCount} with ${mcpContext.messages.length} messages`)
        
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`OpenAI API error: ${response.status} - ${errorText}`)
          throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()
        const message = data.choices[0].message
        
        // Add the assistant message to our context
        mcpContext.messages.push(message)
        
        // Check if the model wants to use tools
        const toolCalls = message.tool_calls
        console.log(`Tool calls: ${toolCalls ? toolCalls.length : 0}`)

        if (toolCalls && toolCalls.length > 0) {
          // Process each tool call
          const extractedToolCalls = extractToolCallsFromOpenAI(message)
          
          // Remove the assistant message we just added since we'll re-add it properly 
          mcpContext.messages.pop()
          
          // Process each tool call in order
          for (const call of extractedToolCalls) {
            // Skip if we've already processed this tool call ID
            if (processedToolCallIds.has(call.id)) {
              console.log(`Skipping already processed tool call ID: ${call.id}`)
              continue
            }
            
            console.log(`Processing tool call: ${call.name}, id: ${call.id}`)
            processedToolCallIds.add(call.id) // Mark as processed
          
            try {
              // Execute the tool
              const toolResult = await executeToolCall(
                supabase,
                call.name,
                call.arguments,
                userProfile,
                companyId
              )
              
              // Add the tool result to the context properly 
              mcpContext = addToolResult(mcpContext, call.id, call.name, toolResult)
            } 
            catch (toolError) {
              console.error(`Error executing tool ${call.name}: ${toolError}`)
              
              // Add error result
              const errorResult = { 
                status: "error", 
                error: toolError.message || "Unknown tool execution error",
                message: `Tool execution failed: ${toolError.message || "Unknown error"}`
              }
              
              mcpContext = addToolResult(mcpContext, call.id, call.name, errorResult)
            }
          }
        } else {
          // The model has finished and provided a final answer
          finalAnswer = message.content || "No response generated."
          console.log("MCP conversation complete after " + iterationCount + " iterations")
          break
        }
      } catch (error) {
        console.error("Error in MCP iteration:", error)
        finalAnswer = `Error during processing: ${error.message}`
        break
      }
      
      // Safety mechanism to prevent infinite loops
      if (iterationCount === MAX_ITERATIONS) {
        finalAnswer = "Maximum number of iterations reached. The conversation was terminated for safety reasons."
        console.warn("MCP reached maximum iterations and was terminated")
      }
    }

    // Check if the response contains an action request and create an action record if needed
    if (finalAnswer && projectData?.id) {
      try {
        const jsonMatch = finalAnswer.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch && jsonMatch[1]) {
          const actionData = JSON.parse(jsonMatch[1].trim())
          console.log('Extracted action data:', actionData)
          
          // Keep the existing action handling logic
          if (actionData.action_type === "data_update" && actionData.field_to_update && actionData.new_value) {
            const { data: actionRecord, error: actionError } = await supabase
              .from('action_records')
              .insert({
                prompt_run_id: promptRunId,
                project_id: projectData.id,
                action_type: 'data_update',
                action_payload: {
                  field: actionData.field_to_update,
                  value: actionData.new_value,
                  description: actionData.description || `Update ${actionData.field_to_update} to ${actionData.new_value}`
                },
                requires_approval: true,
                status: 'pending'
              })
              .select()
              .single()
            
            if (actionError) {
              console.error('Error creating action record:', actionError)
            } else {
              actionRecordId = actionRecord.id
              console.log('Created data update action record:', actionRecord)
              
              // Remove the JSON block from the response
              finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim()
            }
          } else if (actionData.action_type === "message" && actionData.recipient && actionData.message_content) {
            let recipientId = null;
            let senderId = null;
            const recipientName = actionData.recipient.trim();
            const senderName = actionData.sender || "System";
            
            if (recipientName.length > 3 && !["team", "customer", "client", "user"].includes(recipientName.toLowerCase())) {
              const { data: contacts } = await supabase
                .from('contacts')
                .select('id, full_name')
                .ilike('full_name', `%${recipientName}%`);
                
              if (contacts && contacts.length > 0) {
                recipientId = contacts[0].id;
                console.log(`Found contact match for "${recipientName}": ${contacts[0].full_name} (${recipientId})`);
              }
            }
            
            if (senderName && senderName.length > 3 && senderName !== "System") {
              const { data: senders } = await supabase
                .from('contacts')
                .select('id, full_name')
                .ilike('full_name', `%${senderName}%`);
                
              if (senders && senders.length > 0) {
                senderId = senders[0].id;
                console.log(`Found sender match for "${senderName}": ${senders[0].full_name} (${senderId})`);
              }
            }
            
            const { data: actionRecord, error: actionError } = await supabase
              .from('action_records')
              .insert({
                prompt_run_id: promptRunId,
                project_id: projectData.id,
                action_type: 'message',
                action_payload: {
                  recipient: actionData.recipient,
                  sender: senderName,
                  message_content: actionData.message_content,
                  description: actionData.description || `Send message to ${actionData.recipient}`
                },
                message: actionData.message_content,
                recipient_id: recipientId,
                sender_ID: senderId,
                requires_approval: true,
                status: 'pending'
              })
              .select()
              .single();
            
            if (actionError) {
              console.error('Error creating message action record:', actionError);
            } else {
              actionRecordId = actionRecord.id;
              console.log('Created message action record:', actionRecord);
              
              finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
            }
          } else if (actionData.action_type === "set_future_reminder" && actionData.days_until_check) {
            const { data: actionRecord, error: actionError } = await supabase
              .from('action_records')
              .insert({
                prompt_run_id: promptRunId,
                project_id: projectData.id,
                action_type: 'set_future_reminder',
                action_payload: {
                  days_until_check: actionData.days_until_check,
                  check_reason: actionData.check_reason || 'Follow-up check',
                  description: actionData.description || `Check project in ${actionData.days_until_check} days`
                },
                requires_approval: true,
                status: 'pending'
              })
              .select()
              .single();
            
            if (actionError) {
              console.error('Error creating reminder action record:', actionError);
            } else {
              actionRecordId = actionRecord.id;
              console.log('Created reminder action record:', actionRecord);
              
              finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing action data:', parseError)
      }
    }

    // Update prompt run with result
    if (promptRunId) {
      try {
        await supabase
          .from('prompt_runs')
          .update({
            prompt_output: finalAnswer,
            status: 'COMPLETED',
            completed_at: new Date().toISOString()
          })
          .eq('id', promptRunId)
      } catch (updateError) {
        console.error('Error updating prompt run:', updateError)
      }
    }

    console.log('Final AI response returned:', finalAnswer.substring(0, 100) + '...')
    
    // Return the response
    return new Response(JSON.stringify({ 
      reply: finalAnswer,
      projectData: projectData,
      actionRecordId: actionRecordId
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
