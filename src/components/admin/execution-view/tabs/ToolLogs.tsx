
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ToolLog } from '../../types';

interface ToolLogsProps {
  toolLogs: ToolLog[];
}

const ToolLogs: React.FC<ToolLogsProps> = ({ toolLogs }) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  const toggleExpanded = (id: string) => {
    if (expandedLogId === id) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(id);
    }
  };
  
  if (!toolLogs || toolLogs.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        No tool logs available for this execution
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Tool Execution Logs</h3>
      
      {toolLogs.map((log, idx) => {
        const isExpanded = expandedLogId === log.id;
        
        // Parse input from hash if needed
        let inputData: any;
        try {
          // This is just a placeholder - in a real app you'd decode the input_hash
          // or fetch the full input from another table
          inputData = { toolName: log.tool_name };
        } catch (error) {
          inputData = { error: "Could not parse input data" };
        }
        
        // Parse output from string
        let outputData: any;
        try {
          outputData = JSON.parse(log.output_trim);
        } catch (error) {
          outputData = log.output_trim;
        }
        
        return (
          <Card key={log.id} className={isExpanded ? "border-primary" : ""}>
            <div 
              className="p-4 flex justify-between items-center cursor-pointer"
              onClick={() => toggleExpanded(log.id)}
            >
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center rounded-full">
                  {idx + 1}
                </Badge>
                <div>
                  <h4 className="font-medium">{log.tool_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleTimeString()} • {log.duration_ms}ms
                  </p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Badge 
                  variant={log.status_code === 200 ? "success" : "destructive"}
                >
                  {log.status_code === 200 ? "Success" : "Error"}
                </Badge>
                {isExpanded ? (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-2 h-4 w-4" />
                )}
              </div>
            </div>
            
            {isExpanded && (
              <CardContent className="pt-0 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium mb-2">Input</h5>
                    <div className="bg-slate-50 p-3 rounded-md border text-xs overflow-auto max-h-64">
                      <pre>{JSON.stringify(inputData, null, 2)}</pre>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="text-sm font-medium mb-2">Output</h5>
                    <div className="bg-slate-50 p-3 rounded-md border text-xs overflow-auto max-h-64">
                      <pre>{typeof outputData === 'string' ? outputData : JSON.stringify(outputData, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default ToolLogs;
