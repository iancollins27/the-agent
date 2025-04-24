
import React from 'react';
import { DocumentChunk } from './types';
import { ProcessingStatus } from '../KnowledgeBaseExplorer/ProcessingStatus';

interface ChunksListProps {
  chunks: DocumentChunk[];
  onProcessingComplete: () => void;
}

export const ChunksList = ({ chunks, onProcessingComplete }: ChunksListProps) => {
  return (
    <div className="mt-3 pl-6 border-l border-gray-200">
      <p className="text-sm font-medium mb-2">Document Chunks:</p>
      {chunks.map((chunk: DocumentChunk) => (
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
              onProcessingComplete={onProcessingComplete}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
