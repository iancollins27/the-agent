
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface PromptInputProps {
  promptRun: any;
}

const PromptInput: React.FC<PromptInputProps> = ({ promptRun }) => {
  return (
    <Card className="border border-muted">
      <CardContent className="pt-6">
        <div className="font-mono text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md overflow-x-auto max-h-[50vh] overflow-y-auto">
          {promptRun.prompt_input || 'No prompt input available'}
        </div>
      </CardContent>
    </Card>
  );
};

export default PromptInput;
