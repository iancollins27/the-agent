
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { PromptRun } from '../../types';

interface PromptOutputProps {
  promptRun: PromptRun;
}

const PromptOutput: React.FC<PromptOutputProps> = ({ promptRun }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-4">Prompt Output</h3>
        {promptRun.error_message ? (
          <div className="bg-red-50 p-4 rounded-md border border-red-200 text-sm text-red-800">
            <h4 className="font-medium mb-2">Error</h4>
            <pre className="whitespace-pre-wrap">{promptRun.error_message}</pre>
          </div>
        ) : (
          <div className="bg-slate-50 p-4 rounded-md border text-sm">
            <pre className="whitespace-pre-wrap">{promptRun.prompt_output}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PromptOutput;
