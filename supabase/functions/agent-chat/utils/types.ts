
export interface OpenAIEmbeddingParams {
  input: string;
  model: string;
}

export interface VectorSearchResult {
  id: string;
  crm_id: string;
  summary: string;
  next_step: string;
  project_track: string;
  company_id: string;
  company_name: string;
  address: string;
  status: string;
  similarity: number;
  project_name: string;
}
