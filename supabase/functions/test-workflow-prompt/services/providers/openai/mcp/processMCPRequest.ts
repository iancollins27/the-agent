
import { updatePromptRunWithResult } from "../../../../database/prompt-runs.ts";
import { updatePromptRunMetrics } from "../../../../database/tool-logs.ts";
import { createMCPContext, extractToolCallsFromOpenAI } from "../../../../mcp.ts";
import { calculateCost } from "../costCalculator.ts";
import { getMCPOrchestratorPrompt } from "../../../../mcp-system-prompts.ts";
import { getToolDefinitions, filterTools } from "../../../../tools/toolRegistry.ts";
import { handleToolCalls } from "./toolCallHandler.ts";
import { validateContextStructure } from "./contextValidator.ts";

/**
 * Process a request using Model Context Protocol (MCP)
 */
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
  const userPrompt = contextData.user_message || "Analyze this project and determine the next actions.";
  
  // Use the getMCPOrchestratorPrompt function to generate the system prompt with milestone instructions
  const milestoneInstructions = contextData.milestone_instructions || null;
  const enhancedSystemPrompt = getMCPOrchestratorPrompt(
    availableTools.map(t => t.function.name),
    milestoneInstructions
  );
  
  console.log("Using milestone instructions in system prompt:", milestoneInstructions ? "YES" : "NO");
  
  // Initialize MCP context with the enhanced system prompt
  let context = createMCPContext(enhancedSystemPrompt, userPrompt, availableTools);

  let finalAnswer = "";
  let toolOutputs: any[] = [];
  const MAX_ITERATIONS = 5; // Prevent infinite loops
  let iterationCount = 0;

  // Track the state needed for handling tool calls across iterations
  const toolCallState = {
    lastToolDecision: null,
    processedToolCallIds: new Set(),
    toolCallCounts: {} as Record<string, number>, // Track tool call counts to detect loops
    toolLimits: { detect_action: 1 } as Record<string, number> // Define tool limits
  };
  
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
        
        // Process the tool calls and update the context
        const result = await handleToolCalls(
          extractedToolCalls, 
          context, 
          toolCallState, 
          supabase, 
          promptRunId, 
          projectId
        );
        
        context = result.context;
        toolOutputs = [...toolOutputs, ...result.newToolOutputs];
        
        // If we need to break out of the iterations (e.g., due to detected loop)
        if (result.breakIteration) {
          finalAnswer = result.finalAnswer || "Processing terminated due to tool execution issues.";
          break;
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
