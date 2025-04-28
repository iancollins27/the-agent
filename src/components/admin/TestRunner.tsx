
import React from "react";
import { useTestRunner } from "@/hooks/useTestRunner";
import TestRunnerControls from "./tests/TestRunnerControls";
import MCPInfoCard from "./tests/MCPInfoCard";

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
    setUseMCP,
    handleRunTest
  } = useTestRunner({
    selectedPromptIds,
    selectedProjectIds,
    onTestComplete,
    isMultiProjectTest
  });

  const isDisabled = selectedPromptIds.length === 0 || selectedProjectIds.length === 0;

  return (
    <div className="space-y-4">
      <TestRunnerControls
        useMCP={useMCP}
        onMCPChange={setUseMCP}
        onRunTest={handleRunTest}
        isLoading={isLoading}
        isDisabled={isDisabled}
        isMultiProjectTest={isMultiProjectTest}
      />
      <MCPInfoCard visible={useMCP} />
    </div>
  );
};

export default TestRunner;
