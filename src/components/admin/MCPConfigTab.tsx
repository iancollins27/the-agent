
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Tool from '../icons/Tool';
import OrchestratorTabContent from './MCP/OrchestratorTabContent';
import ToolsTabContent from './MCP/ToolsTabContent';
import SettingsTabContent from './MCP/SettingsTabContent';
import { useOrchestratorPrompt } from './MCP/hooks/useOrchestratorPrompt';
import { useToolConfiguration } from './MCP/hooks/useToolConfiguration';

/**
 * MCP Configuration Tab for controlling the MCP (Model Context Protocol) settings
 */
const MCPConfigTab: React.FC = () => {
  // Use our custom hooks for different functionalities
  const {
    orchestratorText,
    setOrchestratorText,
    promptLoading,
    handleSaveOrchestrator,
    isUpdating
  } = useOrchestratorPrompt();
  
  const {
    enabledTools,
    toolDefinitions,
    handleToggleTool,
    handleSaveToolDefinitions
  } = useToolConfiguration();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MCP Configuration</h2>
          <p className="text-muted-foreground">Configure the Model Context Protocol settings</p>
        </div>
      </div>

      <Alert>
        <Tool className="h-4 w-4" />
        <AlertTitle>About MCP</AlertTitle>
        <AlertDescription>
          The Model Context Protocol (MCP) enables sophisticated tool calling and orchestration patterns for AI models.
          Configure the system prompts and tool definitions used by the AI when making decisions.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="orchestrator" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orchestrator">Orchestrator Prompt</TabsTrigger>
          <TabsTrigger value="tools">Tool Definitions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="orchestrator" className="space-y-4">
          <OrchestratorTabContent
            orchestratorText={orchestratorText}
            setOrchestratorText={setOrchestratorText}
            promptLoading={promptLoading}
            handleSaveOrchestrator={handleSaveOrchestrator}
            isUpdating={isUpdating}
          />
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <ToolsTabContent
            enabledTools={enabledTools}
            toolDefinitions={toolDefinitions}
            onToggleTool={handleToggleTool}
            onSaveToolDefinitions={handleSaveToolDefinitions}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SettingsTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MCPConfigTab;
