
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PromptOutputProps {
  promptRun: any;
}

const PromptOutput: React.FC<PromptOutputProps> = ({ promptRun }) => {
  const [viewFormat, setViewFormat] = useState<'text' | 'json'>('text');

  // Try to parse the output as JSON if it's valid JSON
  const isJsonOutput = (() => {
    if (!promptRun.prompt_output) return false;
    try {
      JSON.parse(promptRun.prompt_output);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const renderOutput = () => {
    // If there's an error message, display it
    if (promptRun.error_message) {
      return (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription className="whitespace-pre-wrap">
            {promptRun.error_message}
          </AlertDescription>
        </Alert>
      );
    }

    // If there's no output, display a message
    if (!promptRun.prompt_output) {
      return <div className="text-muted-foreground">No output available</div>;
    }

    // If it's JSON and we want to view it as JSON
    if (isJsonOutput && viewFormat === 'json') {
      try {
        const jsonData = JSON.parse(promptRun.prompt_output);
        return (
          <pre className="font-mono text-sm bg-muted/30 p-4 rounded-md overflow-x-auto max-h-[50vh] overflow-y-auto">
            {JSON.stringify(jsonData, null, 2)}
          </pre>
        );
      } catch (e) {
        return <div className="text-red-500">Error parsing JSON output</div>;
      }
    }

    // Default text view
    return (
      <div className="font-mono text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md overflow-x-auto max-h-[50vh] overflow-y-auto">
        {promptRun.prompt_output}
      </div>
    );
  };

  return (
    <Card className="border border-muted">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium">AI Response</CardTitle>
          {isJsonOutput && (
            <div className="flex gap-2">
              <Button 
                variant={viewFormat === 'text' ? "default" : "outline"} 
                size="sm" 
                onClick={() => setViewFormat('text')}
              >
                Text
              </Button>
              <Button 
                variant={viewFormat === 'json' ? "default" : "outline"} 
                size="sm" 
                onClick={() => setViewFormat('json')}
              >
                JSON
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {promptRun.status === 'PENDING' ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            Processing response...
          </div>
        ) : (
          renderOutput()
        )}
      </CardContent>
    </Card>
  );
};

export default PromptOutput;
