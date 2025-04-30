
import React from 'react';
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { PromptRun } from '../types';

interface PromptRunHeaderProps {
  promptRun: PromptRun;
  handleRerunPrompt: () => void;
  isRerunning: boolean;
}

const PromptRunHeader: React.FC<PromptRunHeaderProps> = ({ 
  promptRun, 
  handleRerunPrompt,
  isRerunning 
}) => {
  return (
    <DialogHeader className="flex flex-row items-center justify-between">
      <div>
        <DialogTitle>Prompt Run Details</DialogTitle>
        <DialogDescription>
          Created at {new Date(promptRun.created_at).toLocaleString()}
        </DialogDescription>
        <div className="mt-2 text-sm flex items-center">
          {promptRun.project_address && (
            <Badge variant="outline" className="font-normal">
              {promptRun.project_address}
            </Badge>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRerunPrompt}
          disabled={isRerunning}
          className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isRerunning ? 'animate-spin' : ''}`} />
          {isRerunning ? "Running..." : "Re-run"}
        </Button>
        
        {promptRun.project_crm_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(promptRun.project_crm_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            CRM Record
          </Button>
        )}
      </div>
    </DialogHeader>
  );
};

export default PromptRunHeader;
