
import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface TestRunnerControlsProps {
  useMCP: boolean;
  onMCPChange: (value: boolean) => void;
  onRunTest: () => void;
  isLoading: boolean;
  isDisabled: boolean;
  isMultiProjectTest?: boolean;
}

const TestRunnerControls: React.FC<TestRunnerControlsProps> = ({
  useMCP,
  onMCPChange,
  onRunTest,
  isLoading,
  isDisabled,
  isMultiProjectTest = false
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Switch 
          id="mcp-toggle" 
          checked={useMCP} 
          onCheckedChange={onMCPChange} 
        />
        <label htmlFor="mcp-toggle" className="text-sm font-medium">
          Use Model Context Protocol (MCP)
        </label>
      </div>
      <Button 
        onClick={onRunTest} 
        disabled={isLoading || isDisabled}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Testing...
          </>
        ) : isMultiProjectTest ? "Run Multi-Project Test" : "Run Test"}
      </Button>
    </div>
  );
};

export default TestRunnerControls;
