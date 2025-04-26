
const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";
import { formatForOpenAI } from "../../mcp.ts";

export async function callOpenAI(prompt: string, model: string = "gpt-4o-mini") {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAIApiKey}`,
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

export async function callOpenAIWithMCP(mcpContext: any, model: string = "gpt-4o") {
  const requestBody = formatForOpenAI(mcpContext);
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAIApiKey}`,
    },
    body: JSON.stringify({
      ...requestBody,
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.error("OpenAI API error:", data.error);
    throw new Error(`OpenAI API error: ${data.error.message || data.error}`);
  }
  
  return data;
}
