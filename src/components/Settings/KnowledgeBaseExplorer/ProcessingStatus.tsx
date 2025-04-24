
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProcessingStatusProps {
  documentId: string;
  metadata: any;
  onProcessingComplete?: () => void;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  documentId,
  metadata,
  onProcessingComplete
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleReprocess = async (processAllChunks = false) => {
    setIsProcessing(true);
    try {
      console.log('Reprocessing document:', documentId, 'with process_all_chunks:', processAllChunks);
      const { error } = await supabase.functions.invoke('process-document-embedding', {
        body: { 
          record_id: documentId,
          process_all_chunks: processAllChunks
        }
      });

      if (error) {
        console.error('Error reprocessing document:', error);
        throw error;
      }

      toast({
        title: "Reprocessing started",
        description: processAllChunks 
          ? "The document and all its chunks will be reprocessed." 
          : "The document will be reprocessed in the background.",
      });

      if (onProcessingComplete) {
        setTimeout(onProcessingComplete, 1000); // Give it a second to update status
      }
    } catch (error) {
      console.error('Error reprocessing document:', error);
      toast({
        title: "Error",
        description: "Failed to reprocess document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const status = metadata?.processing_status || 'pending';
  const isParentDocument = !metadata?.parent_id;
  const hasChunks = metadata?.has_chunks || metadata?.total_chunks > 1;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
        
        {(status === 'failed' || status === 'pending') && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleReprocess(false)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Reprocess'
            )}
          </Button>
        )}
      </div>
      
      {isParentDocument && (status === 'completed' || status === 'failed') && !hasChunks && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs"
          onClick={() => handleReprocess(true)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Creating chunks...
            </>
          ) : (
            'Create chunks'
          )}
        </Button>
      )}
      
      {isParentDocument && hasChunks && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs"
          onClick={() => handleReprocess(true)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Processing all...
            </>
          ) : (
            'Reprocess all chunks'
          )}
        </Button>
      )}
      
      {status === 'failed' && metadata?.error && (
        <div className="flex items-center text-red-500 mt-1">
          <AlertCircle className="h-4 w-4 mr-1" />
          <span className="text-xs">{metadata.error}</span>
        </div>
      )}
    </div>
  );
};
