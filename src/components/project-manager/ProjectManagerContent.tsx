
import React from 'react';
import { Loader2 } from "lucide-react";
import { PromptRun } from '../admin/types';
import EmptyPromptRuns from '../admin/EmptyPromptRuns';
import PromptRunsTable from '../admin/PromptRunsTable';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectManagerContentProps {
  loading: boolean;
  promptRuns: PromptRun[];
  hideReviewed: boolean;
  groupByRoofer?: boolean;
  getEmptyStateMessage: () => string;
  debugInfo: {
    userId?: string;
    companyId?: string;
    statusFilter: string | null;
    onlyMyProjects: boolean;
    projectManagerFilter: string | null;
    timeFilter: string;
  };
  onViewDetails: (run: PromptRun) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onRunReviewed: (promptRunId: string) => void;
}

const ProjectManagerContent: React.FC<ProjectManagerContentProps> = ({
  loading,
  promptRuns,
  hideReviewed,
  groupByRoofer = false,
  getEmptyStateMessage,
  debugInfo,
  onViewDetails,
  onRatingChange,
  onRunReviewed
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate the displayed projects count (after filtering for hideReviewed)
  const displayedRuns = hideReviewed 
    ? promptRuns.filter(run => !run.reviewed)
    : promptRuns;
  
  // Get unique project IDs to show actual project count
  const uniqueProjectIds = new Set(displayedRuns.map(run => run.project_id).filter(Boolean));
  const projectCount = uniqueProjectIds.size;

  if (promptRuns.length === 0) {
    return (
      <EmptyPromptRuns
        message={getEmptyStateMessage()}
        debugInfo={debugInfo}
      />
    );
  }

  // Group by roofer if option is enabled
  if (groupByRoofer) {
    const rooferGroups: Record<string, PromptRun[]> = {};
    
    // Group runs by roofer
    displayedRuns.forEach(run => {
      const rooferName = run.project_roofer_contact || 'Unassigned';
      if (!rooferGroups[rooferName]) {
        rooferGroups[rooferName] = [];
      }
      rooferGroups[rooferName].push(run);
    });
    
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Showing {projectCount} {projectCount === 1 ? 'project' : 'projects'} ({displayedRuns.length} {displayedRuns.length === 1 ? 'prompt run' : 'prompt runs'})
          </p>
        </div>
        
        {Object.entries(rooferGroups).map(([rooferName, runs]) => (
          <Card key={rooferName} className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <CardTitle className="text-lg">{rooferName}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <PromptRunsTable 
                promptRuns={runs} 
                onRatingChange={onRatingChange} 
                onViewDetails={onViewDetails}
                onRunReviewed={onRunReviewed}
                hideReviewed={hideReviewed}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Showing {projectCount} {projectCount === 1 ? 'project' : 'projects'} ({displayedRuns.length} {displayedRuns.length === 1 ? 'prompt run' : 'prompt runs'})
        </p>
      </div>
      
      <PromptRunsTable 
        promptRuns={displayedRuns} 
        onRatingChange={onRatingChange} 
        onViewDetails={onViewDetails}
        onRunReviewed={onRunReviewed}
        hideReviewed={hideReviewed}
      />
    </div>
  );
};

export default ProjectManagerContent;
