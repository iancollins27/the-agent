
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/providers/SettingsProvider";
import { Checkbox } from "@/components/ui/checkbox";

type KnowledgeBaseEntry = {
  id: string;
  title: string;
  content: string;
  url: string;
  created_at: string;
  selected?: boolean;
};

export const KnowledgeBaseExplorer = () => {
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { companySettings } = useSettings();
  const { toast } = useToast();

  useEffect(() => {
    fetchKnowledgeBaseEntries();
  }, []);

  const fetchKnowledgeBaseEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .eq('company_id', companySettings?.id);

      if (error) throw error;

      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
      toast({
        title: "Error",
        description: "Failed to load knowledge base entries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEntrySelection = (id: string) => {
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, selected: !entry.selected } : entry
    ));
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Knowledge Base Explorer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <p>Loading knowledge base entries...</p>
          ) : entries.length === 0 ? (
            <p>No entries found in the knowledge base. Try syncing with Notion first.</p>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={entry.selected}
                    onCheckedChange={() => toggleEntrySelection(entry.id)}
                  />
                  <div>
                    <h3 className="font-medium">{entry.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {entry.content.substring(0, 150)}...
                    </p>
                    {entry.url && (
                      <a 
                        href={entry.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:underline"
                      >
                        View in Notion
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
