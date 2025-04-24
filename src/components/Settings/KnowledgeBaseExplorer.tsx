
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ProcessingStatus } from "./KnowledgeBaseExplorer/ProcessingStatus";
import { useSettings } from "@/providers/SettingsProvider";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Define explicit types for our document data
interface DocumentMetadata {
  parent_id?: string;
  processing_status?: string;
  chunk_index?: number;
  has_chunks?: boolean;
  total_chunks?: number;
  error?: string;
}

interface DocumentChunk {
  id: string;
  title: string;
  content?: string;
  metadata: DocumentMetadata;
  created_at: string;
}

interface Document {
  id: string;
  title: string;
  content?: string;
  file_type: string;
  metadata: DocumentMetadata;
  created_at: string;
  last_updated: string;
  chunks: DocumentChunk[];
}

export const KnowledgeBaseExplorer = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { companySettings } = useSettings();

  useEffect(() => {
    if (companySettings?.id) {
      fetchDocuments();
    }
  }, [companySettings?.id]);

  const fetchDocuments = async () => {
    if (!companySettings?.id) return;
    
    setIsLoading(true);
    try {
      // First, get all parent documents (those without parent_id)
      const { data: parentDocs, error: parentError } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .eq('company_id', companySettings.id)
        .is('metadata->parent_id', null)
        .order('last_updated', { ascending: false });

      if (parentError) {
        console.error('Error fetching parent documents:', parentError);
        return;
      }

      // For each parent document, get its chunks
      const docsWithChunks = await Promise.all(
        (parentDocs || []).map(async (doc) => {
          const { data: chunks, error: chunksError } = await supabase
            .from('knowledge_base_embeddings')
            .select('*')
            .eq('metadata->parent_id', doc.id)
            .order('metadata->chunk_index', { ascending: true });
            
          if (chunksError) {
            console.error(`Error fetching chunks for document ${doc.id}:`, chunksError);
            return { ...doc, chunks: [] };
          }
          
          return { ...doc, chunks: chunks || [] };
        })
      );
      
      setDocuments(docsWithChunks);
    } catch (error) {
      console.error('Error in fetchDocuments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (docId: string) => {
    setExpandedDocs(prev => ({
      ...prev,
      [docId]: !prev[docId]
    }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Knowledge Base Documents</CardTitle>
        <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No documents found in your knowledge base.</p>
            <p className="text-sm mt-2">Upload documents above to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-2">
                    <button 
                      className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                      onClick={() => toggleExpand(doc.id)}
                    >
                      {expandedDocs[doc.id] ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </button>
                    <div>
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {doc.file_type === 'application/pdf' ? 'PDF' : 
                          doc.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'DOCX' : 
                          doc.file_type}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {doc.chunks?.length || 0} chunks
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <ProcessingStatus 
                    documentId={doc.id} 
                    metadata={doc.metadata}
                    onProcessingComplete={fetchDocuments}
                  />
                </div>
                
                {expandedDocs[doc.id] && doc.chunks && doc.chunks.length > 0 && (
                  <div className="mt-3 pl-6 border-l border-gray-200">
                    <p className="text-sm font-medium mb-2">Document Chunks:</p>
                    {doc.chunks.map((chunk: DocumentChunk) => (
                      <div key={chunk.id} className="p-2 border-t">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium">{chunk.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {chunk.content ? chunk.content.substring(0, 100) + '...' : 'No content'}
                            </p>
                          </div>
                          <ProcessingStatus 
                            documentId={chunk.id} 
                            metadata={chunk.metadata}
                            onProcessingComplete={fetchDocuments}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {expandedDocs[doc.id] && (!doc.chunks || doc.chunks.length === 0) && (
                  <div className="mt-3 pl-6">
                    <p className="text-sm text-muted-foreground">No chunks found for this document.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={async () => {
                        await supabase.functions.invoke('process-document-embedding', {
                          body: { record_id: doc.id, process_all_chunks: true }
                        });
                        fetchDocuments();
                      }}
                    >
                      Reprocess with chunking
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
