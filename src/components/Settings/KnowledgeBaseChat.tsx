
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/providers/SettingsProvider";
import { Loader2, AlertCircle, Info, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const KnowledgeBaseChat = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const { companySettings } = useSettings();
  const { toast } = useToast();
  const [aiConfig, setAiConfig] = useState<{ provider: string, model: string } | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [vectorStatus, setVectorStatus] = useState<{
    total: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
    pendingChunks: number;
    totalChunks: number;
    documentsWithPendingChunks: any[];
  } | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [statusCheckPerformed, setStatusCheckPerformed] = useState(false);
  const [processingChunks, setProcessingChunks] = useState(false);

  useEffect(() => {
    const fetchAIConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_config')
          .select('provider, model')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching AI config:', error);
        } else if (data) {
          setAiConfig(data);
          console.log('Loaded AI config:', data);
        }
      } catch (error) {
        console.error('Error fetching AI config:', error);
      }
    };
    
    fetchAIConfig();
    if (companySettings?.id) {
      checkVectorStatus();
    }
  }, [companySettings?.id]);

  const processAllPendingChunks = async () => {
    if (!vectorStatus?.documentsWithPendingChunks?.length) {
      toast({
        title: "No pending chunks",
        description: "There are no pending document chunks to process.",
        variant: "default",
      });
      return;
    }

    setProcessingChunks(true);
    try {
      let processed = 0;
      
      for (const doc of vectorStatus.documentsWithPendingChunks) {
        const { error } = await supabase.functions.invoke('process-document-embedding', {
          body: {
            record_id: doc.id,
            process_all_chunks: true
          }
        });
        
        if (!error) {
          processed++;
        }
      }
      
      toast({
        title: "Processing started",
        description: `Started processing ${processed} of ${vectorStatus.documentsWithPendingChunks.length} documents with pending chunks.`,
        variant: "default",
      });
      
      // Wait a moment before rechecking status to give processing time to start
      setTimeout(() => {
        checkVectorStatus();
      }, 2000);
      
    } catch (error) {
      console.error('Error processing pending chunks:', error);
      toast({
        title: "Processing failed",
        description: "Failed to start processing pending chunks.",
        variant: "destructive",
      });
    } finally {
      setProcessingChunks(false);
    }
  };

  const checkVectorStatus = async () => {
    if (!companySettings?.id) {
      toast({
        title: "Error",
        description: "Company settings not loaded yet",
        variant: "destructive",
      });
      return;
    }

    setCheckingStatus(true);
    try {
      // Clear previous status first to ensure UI update is visible
      setVectorStatus(null);
      setStatusCheckPerformed(false);
      
      console.log('Checking vector status for company:', companySettings.id);
      
      // Get all documents
      const { data: allDocs, error: allDocsError } = await supabase
        .from('knowledge_base_embeddings')
        .select('id, metadata, title')
        .eq('company_id', companySettings.id);

      if (allDocsError) {
        console.error('Error getting all documents:', allDocsError);
        throw allDocsError;
      }
      
      // Filter documents with embeddings
      const { data: docsWithEmbeddings, error: embeddingsError } = await supabase
        .from('knowledge_base_embeddings')
        .select('id')
        .eq('company_id', companySettings.id)
        .not('embedding', 'is', null);
      
      if (embeddingsError) {
        console.error('Error getting documents with embeddings:', embeddingsError);
        throw embeddingsError;
      }

      // Calculate stats
      const total = allDocs?.length || 0;
      const withEmbeddings = docsWithEmbeddings?.length || 0;
      const withoutEmbeddings = total - withEmbeddings;
      
      // Check for parent documents with pending chunks
      const documentsWithPendingChunks = allDocs.filter(doc => 
        !doc.metadata?.parent_id && // Only parent documents
        doc.metadata?.total_chunks > 1 && // Has multiple chunks
        doc.metadata?.processing_status === 'partial' // Partially processed
      );
      
      // Calculate total chunks and pending chunks
      let totalChunks = 0;
      let pendingChunks = 0;
      
      allDocs.forEach(doc => {
        if (doc.metadata?.total_chunks) {
          totalChunks += doc.metadata.total_chunks;
          if (doc.metadata?.processing_status !== 'completed') {
            pendingChunks++;
          }
        } else {
          // Count it as a single chunk
          totalChunks++;
          if (doc.metadata?.processing_status !== 'completed') {
            pendingChunks++;
          }
        }
      });
      
      const newStatus = {
        total,
        withEmbeddings,
        withoutEmbeddings,
        pendingChunks,
        totalChunks,
        documentsWithPendingChunks
      };
      
      console.log('Vector status:', newStatus);
      setVectorStatus(newStatus);
      setStatusCheckPerformed(true);
      
      toast({
        title: "Status Check Complete",
        description: `${withEmbeddings} of ${total} documents have been vectorized. ${pendingChunks} of ${totalChunks} chunks are still pending.`,
        variant: withoutEmbeddings > 0 ? "default" : "default",
      });
      
    } catch (error) {
      console.error('Error checking vector status:', error);
      toast({
        title: "Error",
        description: "Failed to check knowledge base status: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const searchKnowledgeBase = async () => {
    if (!query.trim() || !companySettings?.id) {
      toast({
        title: "Error",
        description: !companySettings?.id ? "Company settings not loaded yet" : "Please enter a query",
        variant: "destructive",
      });
      return null;
    }

    setDebugInfo(null);

    try {
      console.log('Searching knowledge base with query:', query);
      
      const { data, error } = await supabase.functions.invoke('tool-kb-search', {
        body: {
          query: query,
          company_id: companySettings.id,
          top_k: 5
        }
      });

      if (error) {
        console.error('Error searching knowledge base:', error);
        setDebugInfo(`Knowledge base search error: ${error.message}`);
        toast({
          title: "Error",
          description: "Failed to search knowledge base",
          variant: "destructive",
        });
        return null;
      }

      console.log('Knowledge base search results:', data);
      
      if (data?.diagnostic) {
        setDiagnostic(data.diagnostic);
      } else {
        setDiagnostic(null);
      }
      
      setSearchResults(data?.results || []);
      return data?.results || [];
      
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      setDebugInfo(`Knowledge base search exception: ${error.message}`);
      toast({
        title: "Error",
        description: "Failed to search knowledge base",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !companySettings?.id) {
      if (!companySettings?.id) {
        toast({
          title: "Error",
          description: "Company settings not loaded yet",
          variant: "destructive",
        });
      }
      return;
    }

    setIsLoading(true);
    setDiagnostic(null);
    setResponse(null);
    setDebugInfo(null);
    
    try {
      const results = await searchKnowledgeBase();
      
      if (!results || results.length === 0) {
        setResponse(diagnostic || "No relevant information found in the knowledge base.");
        setIsLoading(false);
        return;
      }
      
      const context = results.map(r => `[Source: ${r.title || 'Unknown'}, Similarity: ${r.similarity.toFixed(2)}]\n${r.content}`).join('\n\n');
      
      if (!aiConfig?.provider || !aiConfig?.model) {
        setResponse("AI provider or model not configured. Please set up the AI configuration first.");
        return;
      }
      
      const requestBody = {
        promptType: "knowledge_query",
        contextData: {
          query: query,
          company_id: companySettings.id,
          context: context
        },
        useMCP: false, // Use direct query first for better debugging
        promptText: `Answer the following question using the provided knowledge base context.\n\nContext:\n${context}\n\nQuestion: ${query}`,
        aiProvider: aiConfig.provider,
        aiModel: aiConfig.model
      };
      
      console.log('Querying with:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
        body: requestBody
      });

      if (error) {
        console.error('Error invoking test-workflow-prompt:', error);
        setDebugInfo(`Function invoke error: ${error.message}`);
        throw error;
      }
      
      console.log('Knowledge base response:', data);
      
      if (data.output && data.output.includes("Mock result for unknown prompt type")) {
        // If we get a mock result error, try again with MCP (opposite of our first try)
        setDebugInfo("First attempt failed. Trying with MCP enabled...");
        
        const mcpRequestBody = {
          ...requestBody,
          useMCP: true
        };
        
        console.log('Retrying with MCP:', mcpRequestBody);
        
        const { data: mcpData, error: mcpError } = await supabase.functions.invoke('test-workflow-prompt', {
          body: mcpRequestBody
        });
        
        if (mcpError) {
          throw mcpError;
        }
        
        console.log('MCP response:', mcpData);
        setResponse(mcpData.output);
      } else {
        setResponse(data.output);
      }
    } catch (error) {
      console.error('Error querying knowledge base:', error);
      setDebugInfo(`Final error: ${error.message}`);
      toast({
        title: "Error",
        description: "Failed to query knowledge base",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Test Knowledge Base
          <div className="flex gap-2">
            {vectorStatus?.pendingChunks > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={processAllPendingChunks}
                disabled={processingChunks || !vectorStatus?.documentsWithPendingChunks?.length}
                className="flex items-center gap-1"
              >
                {processingChunks ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Process All Pending Chunks ({vectorStatus.pendingChunks})
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={checkVectorStatus} 
              disabled={checkingStatus || !companySettings?.id}
            >
              {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Check Vector Status
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {vectorStatus && (
          <Alert variant={vectorStatus.withoutEmbeddings > 0 ? "default" : "default"} 
                className={`mb-4 ${vectorStatus.withoutEmbeddings > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
            <Info className="h-4 w-4" />
            <AlertTitle>Vectorization Status</AlertTitle>
            <AlertDescription>
              {vectorStatus.total > 0 ? (
                <div className="space-y-1">
                  <p><strong>{vectorStatus.withEmbeddings}</strong> of <strong>{vectorStatus.total}</strong> documents have been vectorized.</p>
                  
                  <p><strong>{vectorStatus.totalChunks - vectorStatus.pendingChunks}</strong> of <strong>{vectorStatus.totalChunks}</strong> document chunks have been processed.</p>
                  
                  {vectorStatus.documentsWithPendingChunks.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mt-2">Documents with pending chunks:</p>
                      <ul className="text-xs list-disc list-inside">
                        {vectorStatus.documentsWithPendingChunks.map(doc => (
                          <li key={doc.id}>{doc.title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {vectorStatus.pendingChunks > 0 && (
                    <p className="mt-1 text-sm">
                      {vectorStatus.pendingChunks} chunk(s) are pending processing.
                      Use the "Process All Pending Chunks" button above to process them now,
                      or they will be processed in the background over time.
                    </p>
                  )}
                </div>
              ) : (
                <p>No documents found in your knowledge base.</p>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {!statusCheckPerformed && !vectorStatus && !checkingStatus && (
          <Alert variant="default" className="mb-4 bg-blue-50">
            <Info className="h-4 w-4" />
            <AlertTitle>Check Your Vectorization Status</AlertTitle>
            <AlertDescription>
              Click the "Check Vector Status" button above to see if all your documents have been successfully vectorized.
            </AlertDescription>
          </Alert>
        )}
        
        {diagnostic && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Knowledge Base Issue</AlertTitle>
            <AlertDescription>{diagnostic}</AlertDescription>
          </Alert>
        )}

        {debugInfo && (
          <Alert variant="default" className="mb-4 bg-amber-50">
            <Info className="h-4 w-4" />
            <AlertTitle>Debug Information</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{debugInfo}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your knowledge base..."
              className="min-h-[100px]"
            />
          </div>
          
          <Button type="submit" disabled={isLoading || !companySettings?.id || !aiConfig}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : "Send Query"}
          </Button>

          {!aiConfig && (
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>AI Configuration Missing</AlertTitle>
              <AlertDescription>
                Please set up the AI provider and model in the AI Provider Configuration section 
                at the top of the Company Settings page.
              </AlertDescription>
            </Alert>
          )}

          {searchResults.length > 0 && (
            <div className="mt-4 p-2">
              <p className="text-sm font-medium">Found {searchResults.length} relevant document(s)</p>
            </div>
          )}

          {response && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
