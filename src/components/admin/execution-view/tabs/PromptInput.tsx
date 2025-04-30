
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { PromptRun } from '../../types';

interface PromptInputProps {
  promptRun: PromptRun;
}

const PromptInput: React.FC<PromptInputProps> = ({ promptRun }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-4">Prompt Input</h3>
        <div className="bg-slate-50 p-4 rounded-md border text-sm">
          <pre className="whitespace-pre-wrap">{promptRun.prompt_input}</pre>
        </div>
      </CardContent>
    </Card>
  );
};

export default PromptInput;
