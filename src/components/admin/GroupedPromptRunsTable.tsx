
import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { PromptRun } from './types';
import PromptRunStatusBadge from './PromptRunStatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { GroupedPromptRuns } from '@/hooks/usePromptRuns';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface GroupedPromptRunsTableProps {
  groupedPromptRuns: GroupedPromptRuns;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onViewDetails: (promptRun: PromptRun) => void;
}

const GroupedPromptRunsTable: React.FC<GroupedPromptRunsTableProps> = ({ 
  groupedPromptRuns, 
  onRatingChange, 
  onViewDetails 
}) => {
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // Function to toggle project expansion
  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // Function to render stars for rating
  const renderStars = (promptRun: PromptRun) => {
    const rating = promptRun.feedback_rating || 0;
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 cursor-pointer ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => onRatingChange(promptRun.id, star === rating ? null : star)}
          />
        ))}
      </div>
    );
  };

  if (groupedPromptRuns.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No prompt runs found with the current filters.</p>;
  }

  return (
    <div className="space-y-4">
      {groupedPromptRuns.map((group) => (
        <Card key={group.projectId} className="overflow-hidden">
          <CardHeader className="bg-muted/50 py-3 cursor-pointer" onClick={() => toggleProject(group.projectId)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedProjects[group.projectId] ? 
                  <ChevronDown className="h-5 w-5" /> : 
                  <ChevronRight className="h-5 w-5" />
                }
                <CardTitle className="text-lg">{group.projectName}</CardTitle>
                <span className="text-sm text-muted-foreground">{group.projectAddress}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {group.runs.length} {group.runs.length === 1 ? 'prompt run' : 'prompt runs'}
              </div>
            </div>
          </CardHeader>
          
          {expandedProjects[group.projectId] && (
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{run.workflow_prompt_type || 'Unknown'}</TableCell>
                      <TableCell>
                        <PromptRunStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</TableCell>
                      <TableCell>{renderStars(run)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onViewDetails(run)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        
                        {run.project_crm_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(run.project_crm_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            CRM
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};

export default GroupedPromptRunsTable;
