
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MCPOrchestratorPrompt } from './mcp/MCPOrchestratorPrompt';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, ToolIcon } from "lucide-react";

/**
 * MCP Configuration Tab for the Admin Console
 * Allows configuration of MCP orchestrator prompt and tools
 */
export const MCPConfigTab: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState("orchestrator-prompt");
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Model Context Protocol (MCP) Configuration</h2>
        <p className="text-muted-foreground">
          Configure the AI orchestrator system prompt and tool definitions for the Model Context Protocol.
        </p>
      </div>
      
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>About MCP</AlertTitle>
        <AlertDescription>
          The Model Context Protocol enables structured interactions with AI models using tools. 
          The orchestrator system prompt guides the AI on how to use these tools effectively for decision making.
        </AlertDescription>
      </Alert>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orchestrator-prompt">Orchestrator Prompt</TabsTrigger>
          <TabsTrigger value="tools-info">Tools Information</TabsTrigger>
        </TabsList>
        
        <TabsContent value="orchestrator-prompt">
          <MCPOrchestratorPrompt />
        </TabsContent>
        
        <TabsContent value="tools-info">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ToolIcon className="h-5 w-5 mr-2" />
                Available MCP Tools
              </CardTitle>
              <CardDescription>
                These tools can be used by the AI orchestrator to analyze projects and determine appropriate actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-md p-4 bg-slate-50">
                <h3 className="font-medium mb-2">detect_action</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Analyzes project context to determine if action is needed, postponed, or unnecessary. This should always be the first tool used.
                </p>
                <div className="text-xs font-mono bg-slate-100 p-2 rounded">
                  Returns: ACTION_NEEDED, NO_ACTION, SET_FUTURE_REMINDER, REQUEST_HUMAN_REVIEW, QUERY_KNOWLEDGE_BASE
                </div>
              </div>
              
              <div className="border rounded-md p-4 bg-slate-50">
                <h3 className="font-medium mb-2">generate_action</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Generates a specific action based on the project context and decision from detect_action.
                </p>
                <div className="text-xs font-mono bg-slate-100 p-2 rounded">
                  Action types: message, data_update, set_future_reminder, human_in_loop, knowledge_query
                </div>
              </div>
              
              <div className="border rounded-md p-4 bg-slate-50">
                <h3 className="font-medium mb-2">knowledge_base_lookup</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Queries the knowledge base for relevant information when additional context is needed.
                </p>
                <div className="text-xs font-mono bg-slate-100 p-2 rounded">
                  Returns: Array of knowledge base entries with relevance scores
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
