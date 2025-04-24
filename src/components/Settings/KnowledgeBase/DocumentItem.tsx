
import React from 'react';
import { Document } from './types';
import { ChunksList } from './ChunksList';
import { ProcessingStatus } from '../KnowledgeBaseExplorer/ProcessingStatus';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DocumentItemProps {
  doc: Document;
  expanded: boolean;
  onToggleExpand: () => void;
  onProcessingComplete: () => void;
}

export const DocumentItem = ({ 
  doc, 
  expanded, 
  onToggleExpand, 
  onProcessingComplete 
}: DocumentItemProps) => {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-2">
          <button 
            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
            onClick={onToggleExpand}
          >
            {expanded ? 
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
          onProcessingComplete={onProcessingComplete}
        />
      </div>
      
      {expanded && doc.chunks && doc.chunks.length > 0 && (
        <ChunksList chunks={doc.chunks} onProcessingComplete={onProcessingComplete} />
      )}

      {expanded && (!doc.chunks || doc.chunks.length === 0) && (
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
              onProcessingComplete();
            }}
          >
            Reprocess with chunking
          </Button>
        </div>
      )}
    </div>
  );
};
