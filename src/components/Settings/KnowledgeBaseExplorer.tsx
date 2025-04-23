
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ProcessingStatus } from "./KnowledgeBaseExplorer/ProcessingStatus";
import { useSettings } from "@/providers/SettingsProvider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const KnowledgeBaseExplorer = () => {
  const [documents, setDocuments] = useState<any[]>([]);
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
      const { data, error } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .eq('company_id', companySettings.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
      } else {
        setDocuments(data || []);
      }
    } finally {
      setIsLoading(false);
    }
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
                  <div>
                    <h3 className="font-medium">{doc.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {doc.file_type === 'application/pdf' ? 'PDF' : 
                       doc.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'DOCX' : 
                       doc.file_type}
                    </p>
                  </div>
                  <ProcessingStatus 
                    documentId={doc.id} 
                    metadata={doc.metadata}
                    onProcessingComplete={fetchDocuments}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
