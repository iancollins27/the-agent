
export interface OpenAIEmbeddingParams {
  input: string;
  model: string;
}

export interface VectorSearchResult {
  id: string;
  crm_id: string;
  summary: string;
  next_step: string;
  company_id: string;
  company_name: string;
  address: string;
  status: string;
  similarity: number;
  project_name: string;
}

// Add a type definition for UUID to make debugging clearer
type uuid = string;
