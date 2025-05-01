import { executeToolCall } from "../../../../tools/toolExecutor.ts";
import { addToolResult } from "../../../../mcp.ts";

/**
 * Handle tool calls from OpenAI's assistant
 */
export async function handleToolCalls(
  extractedToolCalls: any[],
  context: any,
  toolCallState: {
    lastToolDecision: string | null;
    processedToolCallIds: Set<string>;
    toolCallCounts: Record<string, number>;
    toolLimits: Record<string, number>;
  },
  supabase: any,
  promptRunId: string,
  projectId: string
) {
  // Results to return
  const newToolOutputs: any[] = [];
  let breakIteration = false;
  let finalAnswer: string | null = null;

  // Process each tool call in order
  for (const call of extractedToolCalls) {
    // Skip if we've already processed this tool call ID
    if (toolCallState.processedToolCallIds.has(call.id)) {
      console.log(`Skipping already processed tool call ID: ${call.id}`);
      continue;
    }
    
    // Check if the tool has reached its limit
    if (toolCallState.toolLimits[call.name] && 
        toolCallState.toolCallCounts[call.name] >= toolCallState.toolLimits[call.name]) {
      console.log(`Tool ${call.name} has reached its limit (${toolCallState.toolLimits[call.name]}). Skipping call.`);
      
      // Add a system message explaining the tool limit
      const limitMessage = {
        role: "system",
        content: `The tool '${call.name}' has reached its maximum allowed calls (${toolCallState.toolLimits[call.name]}). Please use the results from previous calls.`
      };
      context.messages.push(limitMessage);
      
      // Skip processing this tool call
      continue;
    }
    
    // Track tool call counts 
    toolCallState.toolCallCounts[call.name] = (toolCallState.toolCallCounts[call.name] || 0) + 1;
    
    // Check for excessive tool calls of the same type (potential loop)
    if (!toolCallState.toolLimits[call.name] && toolCallState.toolCallCounts[call.name] > 3) {
      console.warn(`Excessive calls to ${call.name} detected (${toolCallState.toolCallCounts[call.name]} times). Possible loop.`);
      
      // If it's the create_action_record tool, we might be in a loop
      if (call.name === "create_action_record" && toolCallState.toolCallCounts[call.name] > 3) {
        console.warn("Detected potential infinite loop with create_action_record - terminating iterations");
        finalAnswer = "The system detected a potential infinite loop in tool calls. Analysis was terminated to prevent redundant actions. Please review the generated actions for completeness.";
        
        // Add final warning message to the context
        context.messages.push({
          role: "system",
          content: "WARNING: Potential infinite loop detected with create_action_record tool. Processing terminated."
        });
        
        // Signal to break out of the iteration loop
        breakIteration = true;
        break;
      }
    }
    
    console.log(`Processing tool call: ${call.name}, id: ${call.id}`);
    toolCallState.processedToolCallIds.add(call.id); // Mark as processed
  
    try {
      // If this is a detect_action call, store the decision
      if (call.name === "detect_action" && call.arguments && call.arguments.decision) {
        toolCallState.lastToolDecision = call.arguments.decision;
        console.log(`Detected action decision: ${toolCallState.lastToolDecision}`);
      }
      
      // If this is a create_action_record call, add the decision if it's missing
      if ((call.name === "create_action_record" || call.name === "generate_action") && 
          toolCallState.lastToolDecision) {
        // Make sure we have the arguments as an object
        if (typeof call.arguments === "string") {
          try {
            call.arguments = JSON.parse(call.arguments);
          } catch (e) {
            // If parsing fails, keep it as is
          }
        }
        
        // Add the decision if it's an object and missing the decision
        if (typeof call.arguments === "object" && !call.arguments.decision) {
          call.arguments.decision = toolCallState.lastToolDecision;
        }
        
        // Ensure sender is set for message actions
        if (call.name === "create_action_record" && 
            call.arguments.action_type === "message" && 
            !call.arguments.sender) {
          call.arguments.sender = "BidList Project Manager";
          console.log("Setting default sender to BidList Project Manager");
        }
      }

      // Execute the tool call
      const toolResult = await executeToolCall(
        supabase, 
        call.name, 
        call.arguments, 
        promptRunId, 
        projectId
      );
      
      // Store the tool output for later processing
      newToolOutputs.push({
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
      newToolOutputs.push({
        tool: call.name,
        args: call.arguments,
        result: errorResult
      });
    }
  }

  return {
    context,
    newToolOutputs,
    breakIteration,
    finalAnswer
  };
}
