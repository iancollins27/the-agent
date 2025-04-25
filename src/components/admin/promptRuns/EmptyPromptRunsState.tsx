
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

const EmptyPromptRunsState: React.FC = () => {
  return (
    <Card>
      <CardContent className="py-8">
        <p className="text-center text-muted-foreground">No prompt runs found</p>
      </CardContent>
    </Card>
  );
};

export default EmptyPromptRunsState;
