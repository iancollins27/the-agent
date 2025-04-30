
import { logPromptRun, updatePromptRunWithResult } from "../../database/prompt-runs.ts";
import { createMCPContext, getDefaultTools, addToolResult, extractToolCallsFromOpenAI } from "../../mcp.ts";
import { logToolCall, updatePromptRunMetrics } from "../../database/tool-logs.ts";

export async function processOpenAIRequest(
  prompt: string,
  model: string,
  supabase: any,
  promptRunId: string,
  projectId: string,
  useMCP: boolean,
  contextData: any
) {
  if (useMCP) {
    return await handleMCPRequest(prompt, model, supabase, promptRunId, projectId, contextData);
  } else {
    return await handleStandardRequest(prompt, model, supabase, promptRunId);
  }
}

async function handleStandardRequest(
  prompt: string,
  model: string,
  supabase: any,
  promptRunId: string
) {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Log completion metrics
    if (data.usage) {
      await updatePromptRunMetrics(supabase, promptRunId, {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
        usd_cost: calculateCost(model, data.usage)
      });
    }

    await updatePromptRunWithResult(supabase, promptRunId, aiResponse);
    return { result: aiResponse };
  } catch (error) {
    console.error("Error in standard OpenAI request:", error);
    throw error;
  }
}

async function handleMCPRequest(
  systemPrompt: string,
  model: string,
  supabase: any,
  promptRunId: string,
  projectId: string,
  contextData: any
) {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  // Filter available tools based on what's in contextData
  const availableTools = contextData.available_tools && Array.isArray(contextData.available_tools) 
    ? getDefaultTools().filter(tool => 
        contextData.available_tools.includes(tool.function.name)
      )
    : getDefaultTools();

  console.log(`Available tools: ${availableTools.map(t => t.function.name).join(", ")}`);

  // Get user message from contextData if available, or use default
  const userPrompt = contextData.user_message || "Analyze this project and determine the next actions.";
  
  // Initialize MCP context
  let context = createMCPContext(systemPrompt, userPrompt, availableTools);

  let finalAnswer = "";
  let toolOutputs: any[] = [];
  const MAX_ITERATIONS = 5; // Prevent infinite loops
  let iterationCount = 0;
  
  while (iterationCount < MAX_ITERATIONS) {
    iterationCount++;
    console.log(`Starting MCP iteration ${iterationCount}`);

    try {
      // Make API request to OpenAI
      const payload = {
        model: model,
        messages: context.messages,
        temperature: 0.7
      };
      
      if (context.tools && context.tools.length > 0) {
        // @ts-ignore - Add tools to payload if available
        payload.tools = context.tools;
        // @ts-ignore - Set tool_choice to auto if tools are available
        payload.tool_choice = "auto";
      }
      
      console.log(`Sending OpenAI request for iteration ${iterationCount} with ${context.messages.length} messages`);
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error: ${response.status} - ${errorText}`);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const message = data.choices[0].message;
      
      // Add the assistant message to our context
      context.messages.push(message);
      
      // Log completion metrics
      if (data.usage) {
        await updatePromptRunMetrics(supabase, promptRunId, {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
          usd_cost: calculateCost(model, data.usage)
        });
      }
      
      // Check message content
      console.log(`Message content type: ${typeof message.content}, content: ${message.content}`);

      // Check if the model wants to use tools
      const toolCalls = message.tool_calls;
      console.log(`Tool calls: ${toolCalls ? toolCalls.length : 0}`);

      if (toolCalls && toolCalls.length > 0) {
        // Process each tool call
        const extractedToolCalls = extractToolCallsFromOpenAI(message);
        
        for (const call of extractedToolCalls) {
          console.log(`Processing tool call: ${call.name}, id: ${call.id}`);
        
          try {
            const toolResult = await processToolCall(supabase, call.name, call.arguments, promptRunId, projectId);
            
            // Store the tool output for later processing
            toolOutputs.push({
              tool: call.name,
              args: call.arguments,
              result: toolResult
            });
            
            // Add the tool result as a separate message
            context.messages.push({
              role: "tool",
              tool_call_id: call.id,
              name: call.name,
              content: JSON.stringify(toolResult)
            });
          } 
          catch (toolError) {
            console.error(`Error executing tool ${call.name}: ${toolError}`);
            
            // Add error result as a tool response
            context.messages.push({
              role: "tool",
              tool_call_id: call.id,
              name: call.name,
              content: JSON.stringify({ 
                status: "error", 
                error: toolError.message || "Unknown tool execution error",
                message: `Tool execution failed: ${toolError.message || "Unknown error"}`
              })
            });
            
            // Store the error in tool outputs
            toolOutputs.push({
              tool: call.name,
              args: call.arguments,
              result: { 
                status: "error", 
                error: toolError.message || "Unknown tool execution error",
                message: `Tool execution failed: ${toolError.message || "Unknown error"}`
              }
            });
          }
        }
      } else {
        // The model has finished and provided a final answer
        finalAnswer = message.content || "No response generated.";
        console.log("MCP conversation complete after " + iterationCount + " iterations");
        break;
      }
    } catch (error) {
      console.error("Error in MCP iteration:", error);
      finalAnswer = `Error during MCP processing: ${error.message}`;
      break;
    }
    
    // Safety mechanism to prevent infinite loops
    if (iterationCount === MAX_ITERATIONS) {
      finalAnswer = "Maximum number of iterations reached. The conversation was terminated for safety reasons.";
      console.warn("MCP reached maximum iterations and was terminated");
    }
  }

  // Update the prompt run with the final result
  await updatePromptRunWithResult(supabase, promptRunId, finalAnswer);

  return { 
    result: finalAnswer, 
    toolOutputs: toolOutputs.length > 0 ? toolOutputs : undefined 
  };
}

async function processToolCall(supabase: any, toolName: string, args: any, promptRunId: string, projectId: string) {
  const toolCallId = `call_${Math.random().toString(36).substring(2, 15)}`;
  const startTime = Date.now();
  let status = 200;
  let result;
  let argsString;
  
  try {
    // Convert args to string for logging
    try {
      argsString = typeof args === 'string' ? args : JSON.stringify(args);
    } catch (e) {
      argsString = "Error stringifying args";
    }
    
    // Log the tool call before execution
    await logToolCall(supabase, promptRunId, toolName, toolCallId, argsString, "", 0, 0);

    // Process different tool types
    switch (toolName) {
      case "detect_action":
        // Simply return the args as the result for detect_action
        result = { 
          decision: args.decision,
          reason: args.reason,
          priority: args.priority,
          reminderSet: args.decision === "SET_FUTURE_REMINDER",
          reminderDays: args.days_until_check, 
          status: "success"
        };
        break;
        
      case "create_action_record":
      case "generate_action":
        // Create an action record
        result = await createActionRecord(supabase, promptRunId, projectId, args);
        break;
        
      case "knowledge_base_lookup":
        // Knowledge lookup is disabled for now
        result = { 
          status: "error",
          error: "Knowledge base lookup is currently disabled",
          results: []
        };
        break;
        
      default:
        status = 400;
        result = { 
          status: "error",
          error: `Unknown tool: ${toolName}`
        };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    status = 500;
    result = {
      status: "error",
      error: error.message || "Unknown error"
    };
  }

  // Calculate duration
  const duration = Date.now() - startTime;
  
  // Log the result
  try {
    const resultString = typeof result === 'string' ? result : JSON.stringify(result);
    await logToolCall(
      supabase, 
      promptRunId, 
      toolName, 
      toolCallId, 
      argsString || "", 
      resultString, 
      status, 
      duration
    );
    console.log(`Logged tool call ${toolName} with ID ${toolCallId}`);
  } catch (logError) {
    console.error("Error logging tool call:", logError);
  }

  return result;
}

function calculateCost(model: string, usage: any): number {
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;

  let promptCost = 0;
  let completionCost = 0;

  switch (model) {
    case "gpt-4o":
      promptCost = (promptTokens / 1000) * 0.01;
      completionCost = (completionTokens / 1000) * 0.03;
      break;
    case "gpt-4-32k":
      promptCost = (promptTokens / 1000) * 0.06;
      completionCost = (completionTokens / 1000) * 0.12;
      break;
    case "gpt-4":
      promptCost = (promptTokens / 1000) * 0.03;
      completionCost = (completionTokens / 1000) * 0.06;
      break;
    case "gpt-3.5-turbo-16k":
    case "gpt-3.5-turbo":
      promptCost = (promptTokens / 1000) * 0.001;
      completionCost = (completionTokens / 1000) * 0.002;
      break;
    default:
      console.warn(`Unknown model for cost calculation: ${model}`);
      return 0.0;
  }

  return promptCost + completionCost;
}

// Import at the end to avoid circular dependencies
import { createActionRecord } from "../../database/index.ts";
