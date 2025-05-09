
/**
 * Utilities for generating and working with embeddings
 */

import { OpenAIEmbeddingParams } from "./types.ts";

/**
 * Generates an embedding vector using OpenAI API
 * @param text The text to generate an embedding for
 * @returns A vector of floats representing the text embedding
 */
export async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-ada-002"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Creates a database-compatible vector object from array of numbers
 * @param embedding Array of embedding values
 * @returns A string formatted as a PostgreSQL vector
 */
export function formatEmbeddingForDB(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
