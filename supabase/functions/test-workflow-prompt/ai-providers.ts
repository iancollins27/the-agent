
const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
const claudeApiKey = Deno.env.get("CLAUDE_API_KEY") || "";
const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";

import { MCPContext, formatForOpenAI, formatForClaude, extractToolCallsFromOpenAI, extractToolCallsFromClaude } from "./mcp.ts";

/**
 * Calls the appropriate AI provider based on the specified provider and model
 */
export async function callAIProvider(aiProvider: string, aiModel: string, prompt: string): Promise<string> {
  console.log(`Calling ${aiProvider} model ${aiModel} with prompt length: ${prompt.length}`);
  
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
 * Calls the appropriate AI provider with MCP formatting
 */
export async function callAIProviderWithMCP(
  aiProvider: string, 
  aiModel: string, 
  mcpContext: MCPContext
): Promise<any> {
  console.log(`Calling ${aiProvider} model ${aiModel} with MCP`);
  
  switch (aiProvider) {
    case "openai":
      if (openaiApiKey) {
        return await callOpenAIWithMCP(mcpContext, aiModel);
      } else {
        throw new Error("OpenAI API key not configured");
      }
    case "claude":
      if (claudeApiKey) {
        return await callClaudeWithMCP(mcpContext, aiModel);
      } else {
        throw new Error("Claude API key not configured");
      }
    default:
      throw new Error(`MCP not supported for provider: ${aiProvider}`);
  }
}

/**
 * Calls the OpenAI API with the given prompt and model
 */
async function callOpenAI(prompt: string, model: string = "gpt-4o-mini") {
  try {
    console.log(`Calling OpenAI API with model ${model}`);
    
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
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error (${response.status}):`, errorText);
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    if (data.error) {
      console.error("OpenAI API error:", data.error);
      throw new Error(`OpenAI API error: ${data.error.message || data.error}`);
    }
    
    console.log("OpenAI API call successful");
    return data.choices?.[0]?.message?.content || "Error: No response from OpenAI";
  } catch (error) {
    console.error("Error in callOpenAI:", error);
    throw error;
  }
}

/**
 * Calls the OpenAI API with MCP formatting
 */
async function callOpenAIWithMCP(mcpContext: MCPContext, model: string = "gpt-4o") {
  try {
    console.log(`Calling OpenAI API with MCP and model ${model}`);
    const requestBody = formatForOpenAI(mcpContext);
    
    // Debug the request body 
    console.log("MCP Request structure:", JSON.stringify({
      model: requestBody.model,
      messageCount: requestBody.messages?.length,
      toolsCount: requestBody.tools?.length,
      hasTools: !!requestBody.tools
    }));
    
    // Validate the messages array is present and not empty
    if (!requestBody.messages || requestBody.messages.length === 0) {
      console.error("Error: MCP context has no messages");
      throw new Error("MCP context has no messages");
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: requestBody.model || model,
        messages: requestBody.messages,
        tools: requestBody.tools,
        tool_choice: requestBody.tool_choice,
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error (${response.status}):`, errorText);
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    if (data.error) {
      console.error("OpenAI API error:", data.error);
      throw new Error(`OpenAI API error: ${data.error.message || data.error}`);
    }
    
    console.log("OpenAI MCP API call successful");
    return data;
  } catch (error) {
    console.error("Error in callOpenAIWithMCP:", error);
    throw error;
  }
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
 * Calls the Claude API with MCP formatting
 */
async function callClaudeWithMCP(mcpContext: MCPContext, model: string = "claude-3-5-haiku-20241022") {
  const requestBody = formatForClaude(mcpContext);
  
  // Debug Claude MCP request
  console.log("Claude MCP Request structure:", JSON.stringify({
    model: requestBody.model,
    messageCount: requestBody.messages?.length,
    toolsCount: requestBody.tools?.length,
    hasTools: !!requestBody.tools
  }));
  
  // Validate the messages array is present and not empty
  if (!requestBody.messages || requestBody.messages.length === 0) {
    console.error("Error: MCP context has no messages for Claude");
    throw new Error("MCP context has no messages for Claude");
  }
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: requestBody.model || model,
      messages: requestBody.messages,
      tools: requestBody.tools,
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
