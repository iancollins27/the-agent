
import React from 'react';
import { ToolLog } from '../types';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from "lucide-react";

interface ExecutionToolCallProps {
  toolLog: ToolLog;
  isExpanded: boolean;
  onToggle: () => void;
}

const ExecutionToolCall: React.FC<ExecutionToolCallProps> = ({
  toolLog,
  isExpanded,
  onToggle
}) => {
  const isSuccess = toolLog.status_code >= 200 && toolLog.status_code < 300;
  
  // Format the JSON representation for input and output
  const formatOutput = (output: any): string => {
    try {
      if (typeof output === 'string') {
        // Try to parse as JSON if it's a string that looks like JSON
        if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
          const parsed = JSON.parse(output);
          return JSON.stringify(parsed, null, 2);
        }
        return output;
      }
      return JSON.stringify(output, null, 2);
    } catch (e) {
      return String(output);
    }
  };
  
  return (
    <Card className="border overflow-hidden">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3">
          <Badge 
            className="font-mono bg-slate-200 text-slate-700 hover:bg-slate-200"
          >
            #{toolLog.sequence}
          </Badge>
          
          <span className="font-medium">{toolLog.tool_name}</span>
          
          <Badge 
            variant={isSuccess ? "outline" : "destructive"}
            className={isSuccess ? "bg-green-50 text-green-700 border-green-200" : ""}
          >
            {isSuccess ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {toolLog.status_code}
          </Badge>
          
          <Badge variant="outline" className="font-mono">
            {toolLog.duration_ms}ms
          </Badge>
        </div>
        
        <Button variant="ghost" size="icon">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {isExpanded && (
        <div className="border-t px-4 py-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-gray-500">Input</h4>
              <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap break-words">
                {formatOutput(toolLog.input || { inputHash: toolLog.input_hash })}
              </pre>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-gray-500">Output</h4>
              <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap break-words">
                {formatOutput(toolLog.output || toolLog.output_trim)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ExecutionToolCall;
