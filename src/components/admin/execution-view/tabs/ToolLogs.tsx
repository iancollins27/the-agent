
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ToolLogEntry {
  id: string;
  created_at: string;
  tool_name: string;
  input_hash: string;
  output_trim: string;
  status_code: number;
  duration_ms: number;
}

interface ToolLogsProps {
  toolLogs: ToolLogEntry[];
}

const ToolLogs: React.FC<ToolLogsProps> = ({ toolLogs }) => {
  const [expandedLogs, setExpandedLogs] = React.useState<{ [key: string]: boolean }>({});

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // Try to parse tool args from output
  const parseToolInput = (outputTrim: string): Record<string, any> | null => {
    try {
      // Try to parse the full output as JSON first
      const parsedOutput = JSON.parse(outputTrim);
      
      // If the output has an 'args' property, that's likely our tool args
      if (parsedOutput.args) {
        return parsedOutput.args;
      }
      
      return parsedOutput;
    } catch (e) {
      // If it's not valid JSON, try to extract JSON from the string
      try {
        const jsonMatch = outputTrim.match(/\{.*\}/s);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (innerError) {
        // Ignore inner parsing errors
      }
      
      return null;
    }
  };

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">Success</Badge>;
    } else {
      return <Badge variant="destructive">Error {status}</Badge>;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  };

  if (toolLogs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8 text-muted-foreground">
          No tool logs available for this execution
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {toolLogs.map((log, index) => {
        const isExpanded = expandedLogs[log.id] || false;
        const toolInput = parseToolInput(log.output_trim);
        
        return (
          <Collapsible
            key={log.id}
            open={isExpanded}
            onOpenChange={() => toggleLogExpansion(log.id)}
            className="border rounded-lg"
          >
            <CollapsibleTrigger asChild className="w-full">
              <Button 
                variant="ghost" 
                className="flex items-center justify-between w-full p-4 text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-none w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{log.tool_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {getStatusBadge(log.status_code)}
                      <span>{formatDuration(log.duration_ms)}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Input Parameters</h4>
                    <div className="font-mono text-xs whitespace-pre-wrap bg-muted p-2 rounded-md overflow-x-auto max-h-[20vh] overflow-y-auto">
                      {toolInput ? (
                        JSON.stringify(toolInput, null, 2)
                      ) : (
                        "Unable to parse tool input parameters"
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Output</h4>
                    <div className="font-mono text-xs whitespace-pre-wrap bg-muted p-2 rounded-md overflow-x-auto max-h-[20vh] overflow-y-auto">
                      {log.output_trim || "No output data available"}
                      {log.output_trim && log.output_trim.endsWith('...') && (
                        <div className="text-xs italic mt-1">Output truncated...</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  <div>Tool ID: {log.id}</div>
                  <div>Hash: {log.input_hash?.substring(0, 16)}...</div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};

export default ToolLogs;
