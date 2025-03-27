
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

interface EmptyPromptRunsProps {
  message: string;
  debugInfo?: {
    userId?: string | null;
    companyId?: string | null;
    statusFilter?: string | null;
    onlyMyProjects?: boolean;
    timeFilter?: string;
  };
}

const EmptyPromptRuns: React.FC<EmptyPromptRunsProps> = ({ message, debugInfo }) => {
  return (
    <Card>
      <CardContent className="py-8">
        <p className="text-center text-muted-foreground">
          {message}
        </p>
        {debugInfo && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Debug info:</p>
            <p>User ID: {debugInfo.userId || 'None'}</p>
            <p>Company ID: {debugInfo.companyId || 'None'}</p>
            <p>Status Filter: {debugInfo.statusFilter || 'None'}</p>
            <p>Only My Projects: {debugInfo.onlyMyProjects ? 'Yes' : 'No'}</p>
            <p>Time Filter: {debugInfo.timeFilter || 'None'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmptyPromptRuns;
