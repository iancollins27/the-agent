
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PromptRun } from '../../types';

interface PromptInputProps {
  promptRun: PromptRun;
}

const PromptInput: React.FC<PromptInputProps> = ({ promptRun }) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <pre className="bg-slate-50 p-4 rounded-md text-sm overflow-auto whitespace-pre-wrap">
          {promptRun.prompt_input || 'No input available'}
        </pre>
      </CardContent>
    </Card>
  );
};

export default PromptInput;
