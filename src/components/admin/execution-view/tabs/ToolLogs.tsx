
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ToolLogsProps {
  promptRunId: string;
}

export interface ToolLog {
  id: string;
  tool_name: string;
  tool_call_id?: string;
  tool_args?: string;
  tool_result?: string;
  status_code: number;
  duration_ms: number;
  error_message?: string | null;
  created_at: string;
  input_hash?: string;
  output_trim?: string;
  prompt_run_id?: string;
}

const ToolLogs: React.FC<ToolLogsProps> = ({ promptRunId }) => {
  const { data: toolLogs, isLoading, error } = useQuery({
    queryKey: ['tool-logs', promptRunId],
    queryFn: async () => {
      if (!promptRunId) return [];
      
      const { data, error } = await supabase
        .from('tool_logs')
        .select('*')
        .eq('prompt_run_id', promptRunId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('Error fetching tool logs:', error);
        throw error;
      }
      
      return data as ToolLog[];
    },
    enabled: !!promptRunId
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Tool Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-sm text-muted-foreground">
            Loading tool logs...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Tool Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 p-4 rounded-md text-sm text-red-500 border border-red-200 flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            Error loading tool logs
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!toolLogs || toolLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Tool Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-sm text-muted-foreground">
            No tool logs available for this execution
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse the JSON arguments and results
  const parsedLogs = toolLogs.map(log => {
    let args;
    let result;
    
    try {
      args = typeof log.tool_args === 'string' ? JSON.parse(log.tool_args || '{}') : log.tool_args;
    } catch (e) {
      args = log.tool_args;
    }
    
    try {
      result = typeof log.tool_result === 'string' ? JSON.parse(log.tool_result || '{}') : log.tool_result;
    } catch (e) {
      result = log.tool_result;
    }

    // Handle output_trim as an alternative to tool_result
    if (!result && log.output_trim) {
      try {
        result = JSON.parse(log.output_trim);
      } catch (e) {
        result = log.output_trim;
      }
    }
    
    return {
      ...log,
      parsedArgs: args || {},
      parsedResult: result || {}
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Tool Logs ({toolLogs.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {parsedLogs.map((log, index) => (
          <div key={log.id} className="border rounded-md">
            <div className="p-3 flex justify-between items-center bg-slate-50 rounded-t-md">
              <div className="flex items-center gap-2">
                <Badge variant={log.status_code >= 200 && log.status_code < 300 ? "default" : "destructive"}>
                  {log.tool_name}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ID: {log.tool_call_id || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {log.duration_ms}ms
                </div>
                {log.status_code >= 200 && log.status_code < 300 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            
            <div className="p-3">
              {(log.parsedArgs && Object.keys(log.parsedArgs).length > 0) && (
                <div className="mb-2">
                  <h4 className="font-medium text-sm mb-1">Arguments:</h4>
                  <pre className="bg-slate-50 p-2 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(log.parsedArgs, null, 2)}
                  </pre>
                </div>
              )}
              
              <Separator className="my-2" />
              
              {(log.parsedResult && Object.keys(log.parsedResult).length > 0) && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Result:</h4>
                  <pre className="bg-slate-50 p-2 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(log.parsedResult, null, 2)}
                  </pre>
                </div>
              )}
              
              {log.error_message && (
                <div className="mt-2 text-sm text-red-500 bg-red-50 p-2 rounded border border-red-200">
                  Error: {log.error_message}
                </div>
              )}
            </div>
            
            {index < parsedLogs.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ToolLogs;
