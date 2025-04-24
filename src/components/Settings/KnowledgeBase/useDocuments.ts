
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Document, DocumentChunk, parseMetadata } from "./types";

// Use a very simple type with 'any' for metadata to avoid deep type instantiation
interface SimpleDoc {
  id: string;
  title?: string;
  content?: string;
  file_type?: string;
  metadata: any;
  created_at?: string;
  last_updated?: string;
}

export const useDocuments = (companyId?: string) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = async () => {
    if (!companyId) return;
    
    setIsLoading(true);
    try {
      // First, fetch parent documents
      const { data: rawParentDocs, error: parentError } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .eq('company_id', companyId)
        .is('metadata->parent_id', null)
        .order('last_updated', { ascending: false });

      if (parentError) {
        console.error('Error fetching parent documents:', parentError);
        setIsLoading(false);
        return;
      }

      // Cast to simple type and initialize result array
      const parentDocs = (rawParentDocs || []) as SimpleDoc[];
      const docsWithChunks: Document[] = [];
      
      // Process each document sequentially to avoid type recursion
      for (let i = 0; i < parentDocs.length; i++) {
        const doc = parentDocs[i];
        
        // Fetch chunks for this document
        // Important fix: Use string comparison for the JSON field
        const { data: rawChunks, error: chunksError } = await supabase
          .from('knowledge_base_embeddings')
          .select('*')
          .filter('metadata->parent_id', 'eq', doc.id)
          .order('metadata->chunk_index', { ascending: true });
          
        if (chunksError) {
          console.error(`Error fetching chunks for document ${doc.id}:`, chunksError);
          docsWithChunks.push({
            id: doc.id,
            title: doc.title || 'Untitled Document',
            content: doc.content,
            file_type: doc.file_type || 'unknown',
            metadata: parseMetadata(doc.metadata),
            created_at: doc.created_at || new Date().toISOString(),
            last_updated: doc.last_updated || new Date().toISOString(),
            chunks: []
          });
          continue;
        }
        
        // Process chunks with explicit casting to break type recursion
        const chunks = (rawChunks || []) as SimpleDoc[];
        const mappedChunks: DocumentChunk[] = [];
        
        // Convert chunks one by one to avoid deep type instantiation
        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];
          mappedChunks.push({
            id: chunk.id,
            title: chunk.title || `Chunk ${parseMetadata(chunk.metadata)?.chunk_index || 0}`,
            content: chunk.content,
            metadata: parseMetadata(chunk.metadata),
            created_at: chunk.created_at || new Date().toISOString()
          });
        }
        
        // Add the document with its chunks to the result array
        docsWithChunks.push({
          id: doc.id,
          title: doc.title || 'Untitled Document',
          content: doc.content,
          file_type: doc.file_type || 'unknown',
          metadata: parseMetadata(doc.metadata),
          created_at: doc.created_at || new Date().toISOString(),
          last_updated: doc.last_updated || new Date().toISOString(),
          chunks: mappedChunks
        });
      }
      
      setDocuments(docsWithChunks);
    } catch (error) {
      console.error('Error in fetchDocuments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchDocuments();
    }
  }, [companyId]);

  return { documents, isLoading, fetchDocuments };
};
