
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyPromptRunsStateProps {
  filters: {
    reviewed: boolean;
    rating: number | null;
    hasError: boolean;
    search: string;
  };
  timeFilter: string;
  onResetFilters: () => void;
}

const EmptyPromptRunsState: React.FC<EmptyPromptRunsStateProps> = ({ 
  filters, 
  timeFilter,
  onResetFilters 
}) => {
  // Determine if filters are applied
  const hasActiveFilters = filters.reviewed || 
                           filters.rating !== null || 
                           filters.hasError || 
                           filters.search !== '' ||
                           timeFilter !== 'all';
  
  return (
    <Card>
      <CardContent className="py-8 flex flex-col items-center justify-center gap-4">
        <p className="text-center text-muted-foreground">
          {hasActiveFilters 
            ? "No prompt runs found with the current filters" 
            : "No prompt runs found"}
        </p>
        
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            onClick={onResetFilters}
          >
            Reset Filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default EmptyPromptRunsState;
