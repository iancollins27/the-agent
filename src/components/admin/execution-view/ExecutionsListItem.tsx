
import React from 'react';
import { PromptRun } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Layers } from "lucide-react";
import { useNavigate } from 'react-router-dom';

interface ExecutionsListItemProps {
  promptRun: PromptRun;
}

const ExecutionsListItem: React.FC<ExecutionsListItemProps> = ({ promptRun }) => {
  const navigate = useNavigate();
  
  // Count tool logs if available
  const toolLogsCount = 'tool_logs_count' in promptRun ? promptRun.tool_logs_count : 0;
  
  const handleViewExecution = () => {
    navigate(`/admin/executions/${promptRun.id}`);
  };
  
  return (
    <Card className="hover:bg-gray-50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-medium">
              {promptRun.project_name || 'Unnamed Project'}
              {promptRun.workflow_type && (
                <Badge variant="outline" className="ml-2 font-normal">
                  {promptRun.workflow_type}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {promptRun.relative_time} • {promptRun.ai_model}
            </CardDescription>
          </div>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
            <Layers className="h-3 w-3 mr-1" />
            {toolLogsCount} tool calls
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 line-clamp-2">
          {promptRun.prompt_input.length > 150 
            ? promptRun.prompt_input.substring(0, 150) + "..." 
            : promptRun.prompt_input}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <div className="text-xs text-gray-500">
          {promptRun.project_address || 'No address'}
        </div>
        <Button variant="outline" size="sm" onClick={handleViewExecution}>
          View Execution
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ExecutionsListItem;
