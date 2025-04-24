
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from "@/providers/SettingsProvider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { DocumentItem } from './KnowledgeBase/DocumentItem';
import { useDocuments } from './KnowledgeBase/useDocuments';

export const KnowledgeBaseExplorer = () => {
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const { companySettings } = useSettings();
  const { documents, isLoading, fetchDocuments } = useDocuments(companySettings?.id);

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
              <DocumentItem
                key={doc.id}
                doc={doc}
                expanded={expandedDocs[doc.id]}
                onToggleExpand={() => toggleExpand(doc.id)}
                onProcessingComplete={fetchDocuments}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
