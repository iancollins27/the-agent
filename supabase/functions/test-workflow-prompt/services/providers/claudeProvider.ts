
import { createMCPContext, extractToolCallsFromClaude, addToolResult, getDefaultTools } from "../../mcp.ts";
import { logToolCall } from "../../database/tool-logs.ts";

/**
 * Process a request using the Anthropic Claude API
 */
export async function processClaudeRequest(
  prompt: string,
  model: string,
  supabase: any,
  promptRunId: string,
  projectId: string,
  useMCP: boolean,
  contextData: any
): Promise<{ result: string; toolOutputs?: any[] }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  try {
    if (useMCP) {
      return await handleMCPRequest(apiKey, model, prompt, supabase, promptRunId, projectId, contextData);
    } else {
      return await handleStandardRequest(apiKey, model, prompt);
    }
  } catch (error) {
    console.error("Error in Claude API call:", error);
    throw error;
  }
}

/**
 * Handle a standard (non-MCP) request to Claude
 */
async function handleStandardRequest(apiKey: string, model: string, prompt: string): Promise<{ result: string }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          "role": "user",
          "content": prompt
        }
      ],
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorResponse = await response.text();
    console.error("Claude API error response:", errorResponse);
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return { result: data.content[0].text };
}

/**
 * Handle an MCP request to Claude with tool calling
 */
async function handleMCPRequest(
  apiKey: string, 
  model: string, 
  prompt: string,
  supabase: any,
  promptRunId: string,
  projectId: string,
  contextData: any
): Promise<{ result: string; toolOutputs: any[] }> {
  // Get available tools from the context data
  const availableTools = contextData?.available_tools || ["detect_action", "create_action_record", "knowledge_base_lookup"];
  
  // Create initial MCP context
  const tools = getDefaultTools().filter((tool) => 
    availableTools.includes(tool.function.name)
  );
  
  // Import the getMCPOrchestratorPrompt function
  const { getMCPOrchestratorPrompt } = await import("../../mcp-system-prompts.ts");
  
  // Create the system prompt using available tools
  const systemPrompt = getMCPOrchestratorPrompt(availableTools);
  
  // Format the tools for Claude's API
  const claudeTools = tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: {
      type: "object",
      properties: tool.function.parameters.properties,
      required: tool.function.parameters.required || []
    }
  }));
  
  // Initialize conversation
  let messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: prompt
    }
  ];
  
  const toolOutputs = [];
  let finalResponse = "";
  let isComplete = false;
  let iterations = 0;
  const maxIterations = 5; // Safety limit
  
  // Start the conversation loop
  while (!isComplete && iterations < maxIterations) {
    iterations++;
    
    // Call Claude API with the current context
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        tools: claudeTools,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorResponse = await response.text();
      console.error("Claude API error response:", errorResponse);
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = {
      role: "assistant",
      content: data.content
    };
    
    // Add assistant's message to the conversation
    messages.push(assistantMessage);
    
    // Check if the message contains tool calls
    const toolCalls = extractToolCallsFromClaude(data);
    
    if (toolCalls && toolCalls.length > 0) {
      // Process each tool call
      for (const toolCall of toolCalls) {
        console.log(`Processing tool call: ${toolCall.name}`);
        
        // Log the tool call
        const toolResult = await processToolCall(
          toolCall,
          supabase,
          promptRunId,
          projectId
        );
        
        // Add the tool result to the conversation
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(toolResult)
        });
        
        // Add to our collection of tool outputs
        toolOutputs.push({
          tool: toolCall.name,
          args: toolCall.arguments,
          result: toolResult
        });
      }
    } else {
      // Check if there's text content in the response
      const textContent = data.content.find(item => item.type === 'text');
      if (textContent) {
        finalResponse = textContent.text || "";
        isComplete = true;
      }
    }
  }
  
  if (iterations >= maxIterations) {
    finalResponse = "Maximum number of iterations reached. The conversation was terminated for safety reasons.";
  }
  
  return { 
    result: finalResponse,
    toolOutputs: toolOutputs
  };
}

/**
 * Process a tool call and return the result
 */
async function processToolCall(
  toolCall: { name: string; arguments: any; id: string },
  supabase: any,
  promptRunId: string,
  projectId: string
): Promise<any> {
  const { name: toolName, arguments: toolArgs } = toolCall;
  
  // Start timestamp for duration calculation
  const startTime = performance.now();
  let result = null;
  let statusCode = 200;
  let error = null;
  
  try {
    // Import the services we need for tool execution
    const { 
      createActionRecord, 
      createReminder 
    } = await import("../../database/actions.ts");
    
    const { searchKnowledgeBase } = await import("../../knowledge-service.ts");
    
    // Execute the appropriate tool
    switch (toolName) {
      case "detect_action": {
        // Just return the arguments for now, as this is a detection step
        result = {
          status: "success",
          decision: toolArgs.decision,
          reason: toolArgs.reason,
          priority: toolArgs.priority || "medium"
        };
        
        if (toolArgs.decision === "SET_FUTURE_REMINDER" && toolArgs.days_until_check) {
          const reminderResult = await createReminder(
            supabase,
            projectId,
            toolArgs.days_until_check,
            toolArgs.check_reason || toolArgs.reason
          );
          
          result.reminderSet = true;
          result.reminderDays = toolArgs.days_until_check;
          result.reminderResult = reminderResult;
        }
        
        break;
      }
      
      case "create_action_record": {
        const actionRecord = await createActionRecord(
          supabase,
          projectId,
          toolArgs.action_type,
          toolArgs.description,
          toolArgs.recipient,
          toolArgs.sender,
          toolArgs.message_text
        );
        
        result = {
          status: "success",
          action_record_id: actionRecord.id,
          action_type: toolArgs.action_type
        };
        break;
      }
      
      case "knowledge_base_lookup": {
        const searchResults = await searchKnowledgeBase(supabase, toolArgs.query, toolArgs.project_id || projectId);
        result = {
          status: "success",
          results: searchResults
        };
        break;
      }
      
      case "generate_action": {
        // Legacy support for the deprecated generate_action tool
        console.warn("Using deprecated 'generate_action' tool - please update to create_action_record");
        
        const actionRecord = await createActionRecord(
          supabase,
          projectId,
          toolArgs.action_type,
          toolArgs.description,
          toolArgs.recipient_role,
          "AI Assistant",
          toolArgs.message_text || toolArgs.description
        );
        
        result = {
          status: "success",
          action_record_id: actionRecord.id,
          action_type: toolArgs.action_type,
          deprecated: "generate_action is deprecated, please use create_action_record instead"
        };
        break;
      }
      
      default:
        throw new Error(`Unsupported tool: ${toolName}`);
    }
  } catch (e) {
    console.error(`Error executing tool ${toolName}:`, e);
    statusCode = 500;
    error = e.message;
    result = {
      status: "error",
      error: e.message
    };
  }
  
  // End timestamp for duration calculation
  const endTime = performance.now();
  const durationMs = Math.round(endTime - startTime);
  
  // Log the tool call to the database
  try {
    await logToolCall(
      supabase,
      promptRunId,
      toolName,
      toolCall.id,
      JSON.stringify(toolArgs),
      JSON.stringify(result),
      statusCode,
      durationMs,
      error
    );
  } catch (logError) {
    console.error("Failed to log tool call:", logError);
  }
  
  return result;
}
