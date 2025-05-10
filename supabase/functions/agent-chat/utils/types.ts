
export interface OpenAIEmbeddingParams {
  input: string;
  model: string;
}

export interface VectorSearchResult {
  id: uuid;
  crm_id: string;
  summary: string;
  next_step: string;
  company_id: uuid;
  company_name: string;
  address: string;
  status: string;
  similarity: number;
  project_name: string;
}

// Add a type definition for UUID to make debugging clearer
type uuid = string;
