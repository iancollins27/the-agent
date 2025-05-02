import { updatePromptRunWithResult } from "../../../database/prompt-runs.ts";
import { updatePromptRunMetrics } from "../../../database/tool-logs.ts";
import { createMCPContext, addToolResult, extractToolCallsFromOpenAI } from "../../../mcp.ts";
import { calculateCost } from "./costCalculator.ts";
import { requestHumanReview } from "../../../human-service.ts";
import { getMCPOrchestratorPrompt } from "../../../mcp-system-prompts.ts";
import { getToolDefinitions, filterTools } from "../../../tools/toolRegistry.ts";
import { executeToolCall } from "../../../tools/toolExecutor.ts";

export async function processMCPRequest(
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

  // Default to all available tools if none specified
  let availableTools;
  if (contextData.available_tools && Array.isArray(contextData.available_tools) && contextData.available_tools.length > 0) {
    console.log(`Filtering tools based on specified tools: ${contextData.available_tools.join(', ')}`);
    availableTools = filterTools(contextData.available_tools);
  } else {
    console.log("No specific tools provided, using all available tools");
    availableTools = getToolDefinitions();
  }

  console.log(`Available tools: ${availableTools.map(t => t.function.name).join(", ")}`);

  // Get user message from contextData if available, or use default
  let userPrompt = contextData.user_message || "Analyze this project and determine the next actions.";
  
  // Use the getMCPOrchestratorPrompt function to generate the system prompt with milestone instructions
  const milestoneInstructions = contextData.milestone_instructions || null;
  const enhancedSystemPrompt = getMCPOrchestratorPrompt(
    availableTools.map(t => t.function.name),
    milestoneInstructions
  );
  
  console.log("Using milestone instructions in system prompt:", milestoneInstructions ? "YES" : "NO");
  
  // Add milestone instructions to the user prompt if available
  if (milestoneInstructions) {
    userPrompt = `Milestone Instructions: ${milestoneInstructions}\n\n${userPrompt}`;
  }
  
  // Initialize MCP context with the enhanced system prompt
  let context = createMCPContext(enhancedSystemPrompt, userPrompt, availableTools);

  let finalAnswer = "";
  let toolOutputs: any[] = [];
  const MAX_ITERATIONS = 5; // Prevent infinite loops
  let iterationCount = 0;
  let processedToolCallIds = new Set(); // Track processed tool call IDs to avoid duplicates
  
  // Track tool call counts to detect loops
  const toolCallCounts: Record<string, number> = {};
  
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
        
        // Remove the assistant message we just added since we'll re-add it properly 
        // with the tool responses in the correct sequence
        context.messages.pop();
        
        // Process each tool call in order
        for (const call of extractedToolCalls) {
          // Skip if we've already processed this tool call ID
          if (processedToolCallIds.has(call.id)) {
            console.log(`Skipping already processed tool call ID: ${call.id}`);
            continue;
          }
          
          // Check for excessive tool calls of the same type (potential loop)
          toolCallCounts[call.name] = (toolCallCounts[call.name] || 0) + 1;
          
          if (toolCallCounts[call.name] > 3) {
            console.warn(`Excessive calls to ${call.name} detected (${toolCallCounts[call.name]} times). Possible loop.`);
            
            // If it's the create_action_record tool, we might be in a loop
            if (call.name === "create_action_record" && toolCallCounts[call.name] > 3) {
              console.warn("Detected potential infinite loop with create_action_record - terminating iterations");
              finalAnswer = "The system detected a potential infinite loop in tool calls. Analysis was terminated to prevent redundant actions. Please review the generated actions for completeness.";
              
              // Add final warning message to the context
              context.messages.push({
                role: "system",
                content: "WARNING: Potential infinite loop detected with create_action_record tool. Processing terminated."
              });
              
              // Break out of the while loop
              iterationCount = MAX_ITERATIONS;
              break;
            }
          }
          
          console.log(`Processing tool call: ${call.name}, id: ${call.id}`);
          processedToolCallIds.add(call.id); // Mark as processed
        
          try {
            // Ensure sender is set for message actions
            if (call.name === "create_action_record" && 
                call.arguments.action_type === "message" && 
                !call.arguments.sender) {
              call.arguments.sender = "BidList Project Manager";
              console.log("Setting default sender to BidList Project Manager");
            }

            // Use the executeToolCall function from toolExecutor
            const toolResult = await executeToolCall(
              supabase, 
              call.name, 
              call.arguments, 
              promptRunId, 
              projectId
            );
            
            // Store the tool output for later processing
            toolOutputs.push({
              tool: call.name,
              args: call.arguments,
              result: toolResult
            });
            
            // Add the tool result to the context properly 
            // This will add both the assistant tool call and the tool response
            context = addToolResult(context, call.id, call.name, toolResult);
          } 
          catch (toolError) {
            console.error(`Error executing tool ${call.name}: ${toolError}`);
            
            // Add error result using the addToolResult function to maintain proper context
            const errorResult = { 
              status: "error", 
              error: toolError.message || "Unknown tool execution error",
              message: `Tool execution failed: ${toolError.message || "Unknown error"}`
            };
            
            context = addToolResult(context, call.id, call.name, errorResult);
            
            // Store the error in tool outputs
            toolOutputs.push({
              tool: call.name,
              args: call.arguments,
              result: errorResult
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
    
    // Validate context structure to ensure it's valid
    validateContextStructure(context);
    
    // Safety mechanism to prevent infinite loops
    if (iterationCount === MAX_ITERATIONS) {
      finalAnswer = "Maximum number of iterations reached. The conversation was terminated for safety reasons.";
      console.warn("MCP reached maximum iterations and was terminated");
    }
  }

  // Update the prompt run with the final result
  await updatePromptRunWithResult(supabase, promptRunId, finalAnswer);

  console.log(`Processing ${toolOutputs.length} tool outputs`);
  
  return { 
    result: finalAnswer, 
    toolOutputs: toolOutputs.length > 0 ? toolOutputs : undefined 
  };
}

/**
 * Validate that the conversation context has the proper structure
 * This helps catch issues with missing tool responses
 */
function validateContextStructure(context: any) {
  // Check that each tool call has a corresponding response
  const missingResponses = [];
  
  for (let i = 0; i < context.messages.length; i++) {
    const message = context.messages[i];
    if (message.role === "assistant" && message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const hasResponse = context.messages.some(
          m => m.role === "tool" && m.tool_call_id === toolCall.id
        );
        
        if (!hasResponse) {
          console.error(`Missing tool response for tool_call_id: ${toolCall.id}`);
          missingResponses.push(toolCall.id);
        }
      }
    }
  }
  
  if (missingResponses.length > 0) {
    console.warn(`WARNING: Found ${missingResponses.length} tool calls without responses`);
    console.warn(`Missing response IDs: ${missingResponses.join(', ')}`);
  } else {
    console.log("Context structure validation passed: all tool calls have responses");
  }
}
