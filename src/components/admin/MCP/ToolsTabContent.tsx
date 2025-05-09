
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ToolConfigCard from './ToolConfigCard';
import ToolDefinitionsPanel from './ToolDefinitionsPanel';
import { ChatbotConfigUpdateInput } from './types';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ToolsTabContentProps {
  enabledTools: Record<string, boolean>;
  toolDefinitions: string;
  onToggleTool: (toolName: string, enabled: boolean) => void;
  onSaveToolDefinitions: (definitions: string) => void;
}

/**
 * Content for the Tools tab in MCP configuration
 */
const ToolsTabContent: React.FC<ToolsTabContentProps> = ({
  enabledTools,
  toolDefinitions,
  onToggleTool,
  onSaveToolDefinitions
}) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Available Tools</CardTitle>
          <CardDescription>
            Enable or disable tools available to the MCP orchestrator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4">
              <ToolConfigCard
                name="create_action_record"
                title="Create Action Record"
                description="Creates specific action records based on the orchestrator's decisions"
                enabled={enabledTools.create_action_record}
                onToggle={(enabled) => onToggleTool('create_action_record', enabled)}
                required={true}
              />

              <ToolConfigCard
                name="identify_project"
                title="Identify Project"
                description="Searches and identifies projects based on descriptions, addresses, or IDs"
                enabled={enabledTools.identify_project}
                onToggle={(enabled) => onToggleTool('identify_project', enabled)}
                required={true}
              />

              <ToolConfigCard
                name="knowledge_base_lookup"
                title="Knowledge Base Lookup"
                description="Searches the knowledge base for relevant information"
                enabled={enabledTools.knowledge_base_lookup}
                onToggle={(enabled) => onToggleTool('knowledge_base_lookup', enabled)}
                required={false}
                disabled={true}
                disabledReason="Currently disabled in the system"
              />

              <ToolConfigCard
                name="data_fetch"
                title="Data Fetch"
                description="Fetches data from integrated CRM systems"
                enabled={enabledTools.data_fetch}
                onToggle={(enabled) => onToggleTool('data_fetch', enabled)}
                required={false}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <ToolDefinitionsPanel 
        rawDefinitions={toolDefinitions}
        onSave={onSaveToolDefinitions}
        isSaving={false}
      />
    </div>
  );
};

export default ToolsTabContent;
