
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Document, DocumentChunk, parseMetadata } from "./types";

// Define a simplified type for raw database documents to avoid deep type instantiation
type RawDatabaseDoc = {
  id: string;
  title?: string;
  content?: string;
  file_type?: string;
  metadata: any; // Using any here to avoid deep type inference
  created_at?: string;
  last_updated?: string;
};

export const useDocuments = (companyId?: string) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = async () => {
    if (!companyId) return;
    
    setIsLoading(true);
    try {
      // Cast the response data to our simplified type to avoid deep type instantiation
      const { data: rawParentDocs, error: parentError } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .eq('company_id', companyId)
        .is('metadata->parent_id', null)
        .order('last_updated', { ascending: false });

      if (parentError) {
        console.error('Error fetching parent documents:', parentError);
        return;
      }

      // Explicitly typing the parentDocs to break the type recursion
      const parentDocs: RawDatabaseDoc[] = rawParentDocs || [];
      
      const docsWithChunks: Document[] = [];
      
      // Use a regular for loop instead of Promise.all with map to avoid type recursion
      for (const doc of parentDocs) {
        const { data: rawChunks, error: chunksError } = await supabase
          .from('knowledge_base_embeddings')
          .select('*')
          .eq('metadata->parent_id', doc.id)
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
        
        // Explicitly cast chunks to our simplified type
        const chunks: RawDatabaseDoc[] = rawChunks || [];
        
        // Map chunks with explicit type annotations to avoid deep type instantiation
        const mappedChunks: DocumentChunk[] = chunks.map((chunk) => ({
          id: chunk.id,
          title: chunk.title || `Chunk ${parseMetadata(chunk.metadata)?.chunk_index || 0}`,
          content: chunk.content,
          metadata: parseMetadata(chunk.metadata),
          created_at: chunk.created_at || new Date().toISOString()
        }));
        
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
