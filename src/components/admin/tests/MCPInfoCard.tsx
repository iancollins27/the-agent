
import React from "react";

interface MCPInfoCardProps {
  visible: boolean;
}

const MCPInfoCard: React.FC<MCPInfoCardProps> = ({ visible }) => {
  if (!visible) return null;
  
  return (
    <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
      <span className="font-medium">Model Context Protocol (MCP) enabled</span>: This uses a more structured approach 
      for AI interactions with tool-calling capabilities for knowledge base integration and human-in-the-loop workflows.
      Currently works with OpenAI and Claude providers only.
    </div>
  );
};

export default MCPInfoCard;
