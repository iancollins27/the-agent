
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

interface EmptyPromptRunsProps {
  loading: boolean;
  message?: string;
}

const EmptyPromptRunsState: React.FC<EmptyPromptRunsProps> = ({ 
  loading, 
  message = "No prompt runs found" 
}) => {
  return (
    <Card>
      <CardContent className="py-8">
        <p className="text-center text-muted-foreground">
          {loading ? "Loading prompt runs..." : message}
        </p>
      </CardContent>
    </Card>
  );
};

export default EmptyPromptRunsState;
