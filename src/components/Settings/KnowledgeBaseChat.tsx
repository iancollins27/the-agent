
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/providers/SettingsProvider";

export const KnowledgeBaseChat = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const { companySettings } = useSettings();
  const { toast } = useToast();

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
      console.log('Querying with:', {
        promptType: "knowledge_query",
        contextData: {
          query: query,
          company_id: companySettings.id
        },
        useMCP: true,
        promptText: `Answer the following question using the provided knowledge base context.\n\nQuestion: ${query}`
      });
      
      const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
        body: {
          promptType: "knowledge_query",
          contextData: {
            query: query,
            company_id: companySettings.id
          },
          useMCP: true,
          promptText: `Answer the following question using the provided knowledge base context.\n\nQuestion: ${query}`
        }
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
            {isLoading ? "Processing..." : "Send Query"}
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
