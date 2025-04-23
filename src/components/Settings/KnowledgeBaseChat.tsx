import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/providers/SettingsProvider";
import { Loader2, AlertCircle } from "lucide-react";
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
  } | null>(null);

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
      const { data: totalDocs, error: totalError } = await supabase
        .from('knowledge_base_embeddings')
        .select('id', { count: 'exact' })
        .eq('company_id', companySettings.id);

      if (totalError) throw totalError;
      
      const { data: docsWithEmbeddings, error: embeddingsError } = await supabase
        .from('knowledge_base_embeddings')
        .select('id', { count: 'exact' })
        .eq('company_id', companySettings.id)
        .not('embedding', 'is', null);
      
      if (embeddingsError) throw embeddingsError;

      const total = totalDocs?.length || 0;
      const withEmbeddings = docsWithEmbeddings?.length || 0;
      
      setVectorStatus({
        total,
        withEmbeddings,
        withoutEmbeddings: total - withEmbeddings
      });
      
      console.log(`Vector status: ${withEmbeddings}/${total} documents have embeddings`);
      
    } catch (error) {
      console.error('Error checking vector status:', error);
      toast({
        title: "Error",
        description: "Failed to check knowledge base status",
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
    
    try {
      const results = await searchKnowledgeBase();
      
      if (!results || results.length === 0) {
        setResponse(diagnostic || "No relevant information found in the knowledge base.");
        setIsLoading(false);
        return;
      }
      
      const context = results.map(r => `[Source: ${r.metadata?.source || 'Unknown'}, Similarity: ${r.similarity.toFixed(2)}]\n${r.content}`).join('\n\n');
      
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
        useMCP: true,
        promptText: `Answer the following question using the provided knowledge base context.\n\nContext:\n${context}\n\nQuestion: ${query}`,
        aiProvider: aiConfig.provider,
        aiModel: aiConfig.model
      };
      
      console.log('Querying with:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
        body: requestBody
      });

      if (error) throw error;
      console.log('Knowledge base response:', data);
      setResponse(data.output);
    } catch (error) {
      console.error('Error querying knowledge base:', error);
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
          <Button 
            size="sm" 
            variant="outline" 
            onClick={checkVectorStatus} 
            disabled={checkingStatus || !companySettings?.id}
          >
            {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Check Vector Status
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {vectorStatus && vectorStatus.withoutEmbeddings > 0 && (
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Vectorization incomplete</AlertTitle>
            <AlertDescription>
              Some documents haven't been vectorized yet. This is usually processed in the background.
              You may need to wait a bit longer or check if there's an issue with the embedding process.
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
            <Alert className="mt-4" variant="warning">
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
