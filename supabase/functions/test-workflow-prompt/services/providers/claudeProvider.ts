
const claudeApiKey = Deno.env.get("CLAUDE_API_KEY") || "";
import { formatForClaude } from "../../mcp.ts";

export async function callClaude(prompt: string, model: string = "claude-3-5-haiku-20241022") {
  if (!claudeApiKey) {
    throw new Error("Claude API key is not set");
  }
  
  // Add logging
  console.log(`Calling Claude API with model: ${model}`);
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": claudeApiKey,
      "anthropic-version": "2024-01-01" // Update to latest API version
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.error("Claude API error:", data.error);
    throw new Error(`Claude API error: ${data.error.message || data.error}`);
  }
  
  return data.content?.[0]?.text || "Error: No response from Claude";
}

export async function callClaudeWithMCP(mcpContext: any, model: string = "claude-3-5-haiku-20241022") {
  if (!claudeApiKey) {
    throw new Error("Claude API key is not set");
  }
  
  const requestBody = formatForClaude(mcpContext);
  
  // Add enhanced logging
  console.log("Calling Claude with MCP context");
  console.log("Using model:", model);
  console.log("Claude request format:", JSON.stringify(requestBody, null, 2));
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": claudeApiKey,
      "anthropic-version": "2024-01-01" // Update to latest API version
    },
    body: JSON.stringify({
      ...requestBody,
      max_tokens: 1500,
      temperature: 0.2,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Claude API error (${response.status}):`, errorText);
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  if (data.error) {
    console.error("Claude API error:", data.error);
    throw new Error(`Claude API error: ${data.error.message || data.error}`);
  }
  
  // Log the raw response for debugging
  console.log("Claude API raw response:", JSON.stringify(data, null, 2));
  
  return data;
}
