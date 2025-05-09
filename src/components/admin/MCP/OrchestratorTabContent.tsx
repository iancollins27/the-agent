
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface OrchestratorTabContentProps {
  orchestratorText: string;
  setOrchestratorText: (text: string) => void;
  promptLoading: boolean;
  handleSaveOrchestrator: () => void;
  isUpdating: boolean;
}

/**
 * Content for the Orchestrator tab in MCP configuration
 */
const OrchestratorTabContent: React.FC<OrchestratorTabContentProps> = ({
  orchestratorText,
  setOrchestratorText,
  promptLoading,
  handleSaveOrchestrator,
  isUpdating
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Orchestrator System Prompt</CardTitle>
        <CardDescription>
          This system prompt guides the AI in using tools and making decisions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {promptLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span>Loading prompt...</span>
          </div>
        ) : (
          <>
            <Textarea
              className="min-h-[300px] font-mono"
              value={orchestratorText}
              onChange={(e) => setOrchestratorText(e.target.value)}
            />

            <div className="flex justify-end mt-4">
              <Button 
                onClick={handleSaveOrchestrator}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : "Save Changes"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OrchestratorTabContent;
