
import { updatePromptRunWithResult } from "../../../database/prompt-runs.ts";
import { updatePromptRunMetrics } from "../../../database/tool-logs.ts";
import { calculateCost } from "./costCalculator.ts";

export async function processStandardRequest(
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
