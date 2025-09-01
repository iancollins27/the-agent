
import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTestRunner } from "./hooks/useTestRunner";
import MCPInfoAlert from "./MCPInfoAlert";
import MCPToggle from "./MCPToggle";
import ErrorAlert from "./ErrorAlert";

type TestRunnerProps = {
  selectedPromptIds: string[];
  selectedProjectIds: string[];
  onTestComplete: (results: any) => void;
  isMultiProjectTest?: boolean;
};

const TestRunner: React.FC<TestRunnerProps> = ({ 
  selectedPromptIds, 
  selectedProjectIds, 
  onTestComplete, 
  isMultiProjectTest = false 
}) => {
  const {
    isLoading,
    useMCP,
    error,
    setUseMCP,
    runTest
  } = useTestRunner(
    selectedPromptIds,
    selectedProjectIds,
    onTestComplete,
    isMultiProjectTest
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={runTest} 
          disabled={isLoading || selectedPromptIds.length === 0 || selectedProjectIds.length === 0}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : isMultiProjectTest ? "Run Multi-Project Test" : "Run Test"}
        </Button>
      </div>
      
      <ErrorAlert error={error} />
      
      {useMCP && <MCPInfoAlert />}
    </div>
  );
};

export default TestRunner;
