
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const MCPInfoAlert: React.FC = () => {
  return (
    <Alert className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
      <Info className="h-4 w-4 text-blue-500" />
      <AlertDescription className="ml-2">
        <span className="font-medium">Model Context Protocol (MCP) enabled</span>: This uses a structured approach 
        for AI interactions with tool-calling capabilities including:
        <ul className="mt-1 ml-4 list-disc space-y-1">
          <li>detect_action - Determines if any action is needed</li>
          <li>create_action_record - Creates specific action records</li>
        </ul>
        Currently works with OpenAI and Claude providers only.
      </AlertDescription>
    </Alert>
  );
};

export default MCPInfoAlert;
