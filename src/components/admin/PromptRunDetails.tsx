
import React from 'react';
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PromptRunRating from './PromptRunRating';
import { PromptRun } from './types';

type PromptRunDetailsProps = {
  promptRun: PromptRun;
  onClose: () => void;
  onRatingChange: (promptRunId: string, rating: number) => void;
};

const PromptRunDetails: React.FC<PromptRunDetailsProps> = ({ 
  promptRun, 
  onClose,
  onRatingChange 
}) => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Prompt Run Details</CardTitle>
        <CardDescription>
          Created at {new Date(promptRun.created_at).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">Prompt Input</h3>
          <pre className="bg-slate-100 p-4 rounded overflow-auto max-h-60 text-sm">
            {promptRun.prompt_input}
          </pre>
        </div>
        
        {promptRun.prompt_output && (
          <div>
            <h3 className="font-medium mb-2">Prompt Output</h3>
            <pre className="bg-slate-100 p-4 rounded overflow-auto max-h-60 text-sm">
              {promptRun.prompt_output}
            </pre>
          </div>
        )}
        
        {promptRun.error_message && (
          <div>
            <h3 className="font-medium mb-2 text-red-500">Error</h3>
            <pre className="bg-red-50 p-4 rounded overflow-auto max-h-60 text-sm text-red-500">
              {promptRun.error_message}
            </pre>
          </div>
        )}
        
        <div className="pt-4">
          <h3 className="font-medium mb-2">Feedback</h3>
          <PromptRunRating 
            rating={promptRun.feedback_rating}
            onRatingChange={(rating) => onRatingChange(promptRun.id, rating)}
            size="md"
          />
          
          {promptRun.feedback_description && (
            <p className="text-sm mt-2">{promptRun.feedback_description}</p>
          )}
          
          {promptRun.feedback_tags && promptRun.feedback_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {promptRun.feedback_tags.map((tag, idx) => (
                <Badge key={idx} variant="outline">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
        
        <Button 
          variant="secondary" 
          onClick={onClose}
          className="mt-4"
        >
          Close Details
        </Button>
      </CardContent>
    </Card>
  );
};

export default PromptRunDetails;
