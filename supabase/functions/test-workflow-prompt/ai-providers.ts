
const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
const claudeApiKey = Deno.env.get("CLAUDE_API_KEY") || "";
const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";

/**
 * Calls the appropriate AI provider based on the specified provider and model
 */
export async function callAIProvider(aiProvider: string, aiModel: string, prompt: string): Promise<string> {
  switch (aiProvider) {
    case "openai":
      if (openaiApiKey) {
        return await callOpenAI(prompt, aiModel);
      } else {
        throw new Error("OpenAI API key not configured");
      }
    case "claude":
      if (claudeApiKey) {
        return await callClaude(prompt, aiModel);
      } else {
        throw new Error("Claude API key not configured");
      }
    case "deepseek":
      if (deepseekApiKey) {
        return await callDeepseek(prompt, aiModel);
      } else {
        throw new Error("DeepSeek API key not configured");
      }
    default:
      throw new Error(`Unknown AI provider: ${aiProvider}`);
  }
}

/**
 * Calls the OpenAI API with the given prompt and model
 */
async function callOpenAI(prompt: string, model: string = "gpt-4o-mini") {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that processes project information and provides relevant outputs based on the request type."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.error("OpenAI API error:", data.error);
    throw new Error(`OpenAI API error: ${data.error.message || data.error}`);
  }
  
  return data.choices?.[0]?.message?.content || "Error: No response from OpenAI";
}

/**
 * Calls the Claude API with the given prompt and model
 */
async function callClaude(prompt: string, model: string = "claude-3-5-haiku-20241022") {
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

/**
 * Calls the DeepSeek API with the given prompt and model
 */
async function callDeepseek(prompt: string, model: string = "deepseek-chat") {
  if (!deepseekApiKey) {
    throw new Error("DeepSeek API key is not set");
  }
  
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that processes project information and provides relevant outputs based on the request type."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.error("DeepSeek API error:", data.error);
    throw new Error(`DeepSeek API error: ${data.error.message || data.error}`);
  }
  
  return data.choices?.[0]?.message?.content || "Error: No response from DeepSeek";
}
