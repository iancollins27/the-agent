
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Tool from '@/components/icons/Tool';

interface PromptInputProps {
  promptRun: any;
}

const PromptInput: React.FC<PromptInputProps> = ({ promptRun }) => {
  // Determine if this is an MCP execution
  const isMCPExecution = (promptRun.toolLogsCount || 0) > 0;
  
  return (
    <Card className="border border-muted">
      {isMCPExecution && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center">
            <Tool className="h-4 w-4 mr-2 text-blue-500" />
            <span>Model Context Protocol Input</span>
            <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">MCP</Badge>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={isMCPExecution ? "pt-2" : "pt-6"}>
        <div className="font-mono text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md overflow-x-auto max-h-[50vh] overflow-y-auto">
          {promptRun.prompt_input || 'No prompt input available'}
        </div>
      </CardContent>
    </Card>
  );
};

export default PromptInput;
