
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import Tool from '../icons/Tool';

/**
 * MCP Configuration Tab for controlling the MCP (Model Context Protocol) settings
 */
const MCPConfigTab: React.FC = () => {
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
          <Card>
            <CardHeader>
              <CardTitle>MCP Orchestrator System Prompt</CardTitle>
              <CardDescription>
                This system prompt guides the AI in using tools and making decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[300px] font-mono"
                defaultValue={`You are an advanced AI orchestrator specifically designed to manage project workflows for construction and renovation projects. Your task is to analyze project information systematically and make structured decisions using specialized tools.

WORKFLOW CONTEXT:
You are part of a multi-stage workflow system that helps manage construction projects. When you receive project information, you must analyze it methodically:

1. First, understand the project's current state, timeline, and next steps
2. Determine if any actions are needed based on the project status
3. Generate appropriate actions when needed or set reminders for future follow-up
4. Document your reasoning for transparency and future reference

MEMORY AND CONTEXT:
- Maintain awareness of previous tool calls within the same session
- Reference your prior findings when making subsequent decisions
- Consider historical context from the project summary when determining actions

TOOL USAGE GUIDELINES:
- The detect_action tool should be used FIRST to analyze the situation
- Only after detect_action determines ACTION_NEEDED should you use generate_action
- Use knowledge_base_lookup when you need additional project-specific information
- Always provide clear reasoning for your tool choices

DECISION FRAMEWORK:
- ACTION_NEEDED: When immediate intervention by team members is required
- NO_ACTION: When the project is progressing as expected with no issues
- SET_FUTURE_REMINDER: When no action is needed now but follow-up will be required
- REQUEST_HUMAN_REVIEW: When the situation is too complex or ambiguous
- QUERY_KNOWLEDGE_BASE: When you need additional context to make a decision

Use the available tools systematically to analyze the context and suggest appropriate actions. Always explain your reasoning clearly.`}
              />

              <div className="flex justify-end mt-4">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tool Definitions</CardTitle>
              <CardDescription>
                Define the tools available to the MCP orchestrator
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[300px] font-mono"
                defaultValue={`[
  {
    "name": "detect_action",
    "description": "Analyzes project context to determine if action is needed, postponed, or unnecessary. This should always be your first tool.",
    "parameters": {
      "type": "object",
      "properties": {
        "decision": {
          "type": "string",
          "enum": [
            "ACTION_NEEDED",
            "NO_ACTION",
            "SET_FUTURE_REMINDER",
            "REQUEST_HUMAN_REVIEW",
            "QUERY_KNOWLEDGE_BASE"
          ],
          "description": "The decision about what course of action to take"
        },
        "reason": {
          "type": "string",
          "description": "Detailed explanation of your decision-making process and reasoning"
        },
        "priority": {
          "type": "string",
          "enum": ["high", "medium", "low"],
          "description": "The priority level of the action or reminder"
        }
      },
      "required": ["decision", "reason"]
    }
  },
  {
    "name": "generate_action",
    "description": "Creates a specific action for team members to execute based on the project's needs. Only use after detect_action confirms ACTION_NEEDED.",
    "parameters": {
      "type": "object",
      "properties": {
        "action_type": {
          "type": "string",
          "description": "The type of action to be taken"
        },
        "description": {
          "type": "string",
          "description": "Detailed description of what needs to be done"
        },
        "recipient_role": {
          "type": "string",
          "enum": ["project_manager", "customer", "roofer"],
          "description": "Who should receive this action"
        }
      },
      "required": ["action_type", "description", "recipient_role"]
    }
  },
  {
    "name": "knowledge_base_lookup",
    "description": "Searches the knowledge base for relevant information about the project",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The search query to find relevant information"
        },
        "project_id": {
          "type": "string",
          "description": "Optional project ID to limit the search scope"
        }
      },
      "required": ["query"]
    }
  }
]`}
              />

              <div className="flex justify-end mt-4">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>MCP Settings</CardTitle>
              <CardDescription>
                Configure how the MCP system operates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium">Default AI Provider</label>
                  <select className="w-full mt-1 border rounded p-2">
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium">Default AI Model</label>
                  <select className="w-full mt-1 border rounded p-2">
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MCPConfigTab;
