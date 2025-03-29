
import React from 'react';
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyPromptRunsProps {
  message: string;
  debugInfo?: {
    userId?: string;
    companyId?: string;
    statusFilter?: string | null;
    onlyMyProjects?: boolean;
    projectManagerFilter?: string | null;
    timeFilter?: string;
  };
}

const EmptyPromptRuns: React.FC<EmptyPromptRunsProps> = ({ message, debugInfo }) => {
  return (
    <Card className="bg-white border-dashed border-2 border-slate-200">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <AlertCircle className="h-16 w-16 text-slate-300" />
        <div className="space-y-2 max-w-md">
          <h3 className="text-xl font-medium text-slate-900">No prompt runs found</h3>
          <p className="text-slate-500 whitespace-pre-line">{message}</p>
          
          {debugInfo && process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left text-xs bg-slate-50 p-2 rounded border">
              <summary className="cursor-pointer text-slate-500 font-mono">Debug information</summary>
              <pre className="mt-2 text-slate-600 overflow-x-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EmptyPromptRuns;
