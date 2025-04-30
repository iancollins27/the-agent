
import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface MCPToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const MCPToggle: React.FC<MCPToggleProps> = ({ checked, onCheckedChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <Switch 
        id="mcp-toggle" 
        checked={checked} 
        onCheckedChange={onCheckedChange} 
      />
      <Label htmlFor="mcp-toggle" className="text-sm font-medium">
        Use Model Context Protocol (MCP)
      </Label>
    </div>
  );
};

export default MCPToggle;
