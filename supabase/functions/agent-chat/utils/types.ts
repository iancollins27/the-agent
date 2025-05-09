
/**
 * Common types for utility functions
 */

export interface OpenAIEmbeddingParams {
  input: string;
  model: string;
}

export interface VectorSearchResult {
  id: string;
  crm_id: string | null;
  summary: string | null;
  next_step: string | null;
  project_track: string | null;
  company_id: string | null;
  company_name: string | null;
  address: string | null;
  status: string | null;
  similarity: number;
  project_name?: string | null;
}

