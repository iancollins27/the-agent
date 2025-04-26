
import { formatForOpenAI } from "../../mcp.ts";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";

export async function callOpenAI(prompt: string, model: string = "gpt-4o"): Promise<string> {
  if (!openAIApiKey) {
    throw new Error("OpenAI API key is not set");
  }
  
  // Add logging
  console.log(`Calling OpenAI API with model: ${model}`);
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAIApiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage;
    
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.error?.message || `OpenAI API error: ${response.status}`;
    } catch {
      errorMessage = `OpenAI API error: ${response.status} - ${errorBody.substring(0, 200)}`;
    }
    
    console.error(`OpenAI API error details: Status ${response.status}, Body:`, errorBody);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Log token usage for metrics
  if (data.usage) {
    console.log(`OpenAI token usage: ${data.usage.prompt_tokens} prompt, ${data.usage.completion_tokens} completion`);
  }
  
  return data.choices[0].message.content;
}

export async function callOpenAIWithMCP(mcpContext: any, model: string = "gpt-4o"): Promise<any> {
  if (!openAIApiKey) {
    throw new Error("OpenAI API key is not set");
  }
  
  const requestBody = formatForOpenAI(mcpContext);
  
  // Add enhanced logging
  console.log(`Calling OpenAI MCP API with model: ${model}`);
  console.log(`Request contains ${mcpContext.messages.length} messages and ${mcpContext.tools?.length || 0} tools`);
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAIApiKey}`
    },
    body: JSON.stringify({
      ...requestBody,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage;
    
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.error?.message || `OpenAI API error: ${response.status}`;
    } catch {
      errorMessage = `OpenAI API error: ${response.status} - ${errorBody.substring(0, 200)}`;
    }
    
    console.error(`OpenAI API error details: Status ${response.status}, Body:`, errorBody);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Log token usage for metrics
  if (data.usage) {
    console.log(`OpenAI token usage: ${data.usage.prompt_tokens} prompt, ${data.usage.completion_tokens} completion`);
  }
  
  // Log if tool calls were found
  if (data.choices?.[0]?.message?.tool_calls) {
    console.log(`Found ${data.choices[0].message.tool_calls.length} tool calls in OpenAI response`);
  } else {
    console.log("No tool calls found in OpenAI response");
  }
  
  return data;
}
