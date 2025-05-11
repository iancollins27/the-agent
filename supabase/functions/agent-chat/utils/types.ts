
export interface OpenAIEmbeddingParams {
  input: string;
  model: string;
}

export interface VectorSearchResult {
  address: string;
  similarity: number;
}

// Add a type definition for UUID to make debugging clearer
type uuid = string;
