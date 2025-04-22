
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/providers/SettingsProvider";
import { Loader2 } from "lucide-react";

export const KnowledgeBaseChat = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const { companySettings } = useSettings();
  const { toast } = useToast();
  const [aiConfig, setAiConfig] = useState<{ provider: string, model: string } | null>(null);

  // Fetch AI configuration on component mount
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
  }, []);

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
    try {
      const requestBody = {
        promptType: "knowledge_query",
        contextData: {
          query: query,
          company_id: companySettings.id
        },
        useMCP: true,
        promptText: `Answer the following question using the provided knowledge base context.\n\nQuestion: ${query}`,
        aiProvider: aiConfig?.provider || 'openai',
        aiModel: aiConfig?.model || 'gpt-4o'
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
        <CardTitle>Test Knowledge Base</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your knowledge base..."
              className="min-h-[100px]"
            />
          </div>
          
          <Button type="submit" disabled={isLoading || !companySettings?.id}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : "Send Query"}
          </Button>

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
