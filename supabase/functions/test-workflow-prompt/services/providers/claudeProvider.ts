
const claudeApiKey = Deno.env.get("CLAUDE_API_KEY") || "";

export async function callClaude(prompt: string, model: string = "claude-3-5-haiku-20241022") {
  if (!claudeApiKey) {
    throw new Error("Claude API key is not set");
  }
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": claudeApiKey,
      "anthropic-version": "2023-06-01"
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
  const requestBody = formatForClaude(mcpContext);
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      ...requestBody,
      max_tokens: 1500,
      temperature: 0.2,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.error("Claude API error:", data.error);
    throw new Error(`Claude API error: ${data.error.message || data.error}`);
  }
  
  return data;
}
