
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Tool from '@/components/icons/Tool';

interface PromptInputProps {
  promptRun: any; // Keep as any since it might have additional properties
}

const PromptInput: React.FC<PromptInputProps> = ({ promptRun }) => {
  // Determine if this is an MCP execution
  const isMCPExecution = promptRun.toolLogsCount ? 
    promptRun.toolLogsCount > 0 : // Use the property if it exists
    Array.isArray(promptRun.toolLogs) && promptRun.toolLogs.length > 0; // Fallback to checking toolLogs array

  const toolsUsed = promptRun.toolLogs?.map(log => log.tool_name).filter((value, index, self) => 
    self.indexOf(value) === index
  ) || [];
  
  return (
    <Card className="border border-muted">
      {isMCPExecution && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center flex-wrap">
            <div className="flex items-center">
              <Tool className="h-4 w-4 mr-2 text-blue-500" />
              <span>Model Context Protocol Input</span>
              <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">MCP</Badge>
            </div>
            
            {toolsUsed.length > 0 && (
              <div className="ml-auto flex flex-wrap gap-1 mt-1 sm:mt-0">
                {toolsUsed.map(tool => (
                  <Badge key={tool} variant="secondary" className="text-xs">
                    {tool}
                  </Badge>
                ))}
              </div>
            )}
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
