
import { Json } from "@/integrations/supabase/types";

export interface DocumentMetadata {
  parent_id?: string;
  processing_status?: string;
  chunk_index?: number;
  has_chunks?: boolean;
  total_chunks?: number;
  error?: string;
}

export interface DocumentChunk {
  id: string;
  title: string;
  content?: string;
  metadata: DocumentMetadata;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  content?: string;
  file_type: string;
  metadata: DocumentMetadata;
  created_at: string;
  last_updated: string;
  chunks: DocumentChunk[];
}

export const parseMetadata = (metadata: Json | null): DocumentMetadata => {
  if (!metadata) return {};
  if (typeof metadata === 'object' && metadata !== null) {
    return metadata as unknown as DocumentMetadata;
  }
  return {};
};
