
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { getChatSystemPrompt } from './mcp-system-prompts.ts'
import { createMCPContextManager } from './context/mcp-context-manager.ts'
import { processActionRequest } from './action-processor.ts'
import { logPromptCompletion, calculateOpenAICost } from './observability.ts'

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
    
    console.log(`Agent chat request received: ${messages.length} messages${projectId ? `, project ID: ${projectId}` : ''}`)
    
    // Get chatbot configuration - Using try/catch instead of .catch()
    let configData = null;
    try {
      const { data, error } = await supabase
        .from('chatbot_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error) {
        console.log('Error fetching chatbot config:', error);
      } else {
        configData = data;
        console.log('Successfully fetched chatbot configuration');
      }
    } catch (err) {
      console.log('Exception when fetching chatbot config:', err);
    }
    
    const botConfig = configData || {
      system_prompt: null, 
      model: 'gpt-4o-mini',
      temperature: 0.7,
      search_project_data: true,
      enable_mcp: true // MCP is always enabled now
    }
    
    console.log('Using bot configuration:', botConfig)

    // Get AI configuration - Using try/catch instead of .catch()
    let aiConfig = null;
    try {
      const { data, error } = await supabase
        .from('ai_config')
        .select('provider, model')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error) {
        console.log('Error fetching AI config:', error);
      } else {
        aiConfig = data;
      }
    } catch (err) {
      console.log('Exception when fetching AI config:', err);
    }
    
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
    
    // Check if there's a project ID in the URL or a project is already in context from previous messages
    if (projectId) {
      console.log('Fetching project data for ID from URL parameter:', projectId)
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
        console.log('Found project data by ID from URL parameter:', project)
        
        // Add a system message to explicitly tell the AI that a project is in context
        if (messages.length > 0 && messages[0].role === 'system') {
          messages[0].content += `\n\nProject ${project.id} data is already in your context. Do not re-identify this project unless explicitly asked.`;
        }
      }
    } else {
      // Look for project context in previous messages
      // Try to find if a project was already identified in the conversation
      console.log('Checking for project context in previous messages');
      
      const toolResponseMessages = messages.filter(m => 
        m.role === 'tool' && 
        m.content && 
        m.content.includes('identify_project') && 
        m.content.includes('"status":"success"') &&
        m.content.includes('"found":true')
      );
      
      if (toolResponseMessages.length > 0) {
        console.log('Found previous project identification in conversation history');
        try {
          // Get the most recent successful project identification
          const lastToolResponse = toolResponseMessages[toolResponseMessages.length - 1];
          const toolResult = JSON.parse(lastToolResponse.content);
          
          if (toolResult.projects && toolResult.projects.length > 0) {
            console.log('Reusing previously identified project from conversation:', toolResult.projects[0]);
            // We don't need to store the full project data here as it will be re-fetched
            // by the identify_project tool if needed, but we can add a hint
            contextData.previouslyIdentifiedProject = {
              id: toolResult.projects[0].id,
              crm_id: toolResult.projects[0].crm_id
            };
            
            // Add a system message to explicitly tell the AI that a project was already identified
            const systemMessage = {
              role: 'system',
              content: `The project with ID ${toolResult.projects[0].id} (CRM ID: ${toolResult.projects[0].crm_id}) has already been identified in the conversation. Use the existing context instead of looking it up again. Only re-identify if the user specifically asks about a different project.`
            };
            
            // Insert as the second message to ensure it's near the beginning but after the initial system prompt
            if (messages.length > 0) {
              messages.splice(1, 0, systemMessage);
            } else {
              messages.push(systemMessage);
            }
          }
        } catch (error) {
          console.error('Error processing previous project identification:', error);
        }
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

    // Use the orchestrator prompt from the config if available, otherwise use the default
    let systemPrompt;
    if (botConfig.system_prompt) {
      systemPrompt = botConfig.system_prompt;
      console.log('Using orchestrator prompt from config');
    } else {
      systemPrompt = getChatSystemPrompt([], contextData);
      console.log('Using default system prompt');
    }
    
    // Configure available tools from settings
    const availableTools = botConfig.available_tools || [];
    
    console.log(`Available tools: ${availableTools.join(', ')}`);
    
    // Create MCP context with first user message - MCP is always enabled now
    const mcpContext = createMCPContextManager(systemPrompt, latestUserMessage, availableTools)
    
    // Add previous messages to the context (except the last user message which is already added)
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role !== 'system') { // Skip system messages as we use our own
        mcpContext.messages.push({
          role: messages[i].role,
          content: messages[i].content
        })
      }
    }
    
    // Process MCP conversation
    let finalAnswer = ''
    let actionRecordId = null
    
    const MAX_ITERATIONS = 5 // Prevent infinite loops
    let iterationCount = 0
    const processedToolCallIds = new Set<string>() // Track processed tool call IDs
    
    // Main conversation loop
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
          // @ts-ignore - Add tools to payload
          payload.tools = mcpContext.tools
          // @ts-ignore - Set tool_choice to auto
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
        
        // Track metrics
        const metrics = data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
          cost: calculateOpenAICost(aiModel, {
            prompt: data.usage.prompt_tokens,
            completion: data.usage.completion_tokens
          })
        } : undefined;
        
        // Process the response
        const result = await mcpContext.processResponse(
          data, 
          supabase, 
          userProfile, 
          companyId
        );
        
        // Update processed tool call IDs
        result.processedToolCallIds.forEach(id => processedToolCallIds.add(id));
        
        // If we have a final answer, we're done
        if (result.finalAnswer) {
          finalAnswer = result.finalAnswer;
          projectData = result.projectData || projectData;
          
          // Process any action requests in the final answer
          const actionResult = await processActionRequest(supabase, finalAnswer, projectData);
          finalAnswer = actionResult.finalAnswer;
          actionRecordId = actionResult.actionRecordId;
          
          break;
        }
        
        // If we've had a project identified, store it
        if (result.projectData && !projectData) {
          projectData = result.projectData;
          
          // Add a system message to tell the AI that this project is now in context
          mcpContext.addSystemMessage(`Project ${result.projectData.id} information is now in your context. You do not need to identify it again for follow-up questions. Focus on answering the user's questions directly using this context.`);
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

    // Update prompt run with result
    if (promptRunId) {
      await logPromptCompletion(supabase, promptRunId, finalAnswer);
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
