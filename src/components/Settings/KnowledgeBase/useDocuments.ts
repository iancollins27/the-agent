
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Document, DocumentChunk, parseMetadata } from "./types";

export const useDocuments = (companyId?: string) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = async () => {
    if (!companyId) return;
    
    setIsLoading(true);
    try {
      const { data: parentDocs, error: parentError } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .eq('company_id', companyId)
        .is('metadata->parent_id', null)
        .order('last_updated', { ascending: false });

      if (parentError) {
        console.error('Error fetching parent documents:', parentError);
        return;
      }

      const docsWithChunks: Document[] = await Promise.all(
        (parentDocs || []).map(async (doc: any) => {
          const { data: chunks, error: chunksError } = await supabase
            .from('knowledge_base_embeddings')
            .select('*')
            .eq('metadata->parent_id', doc.id)
            .order('metadata->chunk_index', { ascending: true });
            
          if (chunksError) {
            console.error(`Error fetching chunks for document ${doc.id}:`, chunksError);
            return {
              id: doc.id,
              title: doc.title || 'Untitled Document',
              content: doc.content,
              file_type: doc.file_type || 'unknown',
              metadata: parseMetadata(doc.metadata),
              created_at: doc.created_at || new Date().toISOString(),
              last_updated: doc.last_updated || new Date().toISOString(),
              chunks: []
            };
          }
          
          const mappedChunks: DocumentChunk[] = (chunks || []).map((chunk: any) => ({
            id: chunk.id,
            title: chunk.title || `Chunk ${parseMetadata(chunk.metadata)?.chunk_index || 0}`,
            content: chunk.content,
            metadata: parseMetadata(chunk.metadata),
            created_at: chunk.created_at || new Date().toISOString()
          }));
          
          return {
            id: doc.id,
            title: doc.title || 'Untitled Document',
            content: doc.content,
            file_type: doc.file_type || 'unknown',
            metadata: parseMetadata(doc.metadata),
            created_at: doc.created_at || new Date().toISOString(),
            last_updated: doc.last_updated || new Date().toISOString(),
            chunks: mappedChunks
          };
        })
      );
      
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
