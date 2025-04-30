
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PromptRun } from '../../types';

interface PromptOutputProps {
  promptRun: PromptRun;
}

const PromptOutput: React.FC<PromptOutputProps> = ({ promptRun }) => {
  if (!promptRun.prompt_output && promptRun.error_message) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="pt-6 space-y-2">
          <h3 className="text-sm font-medium text-red-700">Error</h3>
          <pre className="bg-red-100/50 p-4 rounded-md text-sm text-red-800 overflow-auto whitespace-pre-wrap">
            {promptRun.error_message}
          </pre>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <pre className="bg-slate-50 p-4 rounded-md text-sm overflow-auto whitespace-pre-wrap">
          {promptRun.prompt_output || 'No output available yet'}
        </pre>
      </CardContent>
    </Card>
  );
};

export default PromptOutput;
