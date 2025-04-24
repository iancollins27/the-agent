
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

interface EmptyPromptRunsProps {
  loading: boolean;
}

const EmptyPromptRunsState: React.FC<EmptyPromptRunsProps> = ({ loading }) => {
  return (
    <Card>
      <CardContent className="py-8">
        <p className="text-center text-muted-foreground">
          {loading ? "Loading prompt runs..." : "No prompt runs found"}
        </p>
      </CardContent>
    </Card>
  );
};

export default EmptyPromptRunsState;
