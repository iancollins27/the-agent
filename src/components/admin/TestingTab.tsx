
import { useState } from "react";
import TestResults from "@/components/admin/TestResults";
import TestSelection from "@/components/admin/TestSelection";
import TestRunner from "@/components/admin/TestRunner";

const TestingTab = () => {
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<any>(null);
  const [isMultiProjectTest, setIsMultiProjectTest] = useState(false);
  
  return (
    <div className="space-y-6">
      <TestSelection 
        selectedPromptIds={selectedPromptIds}
        setSelectedPromptIds={setSelectedPromptIds}
        selectedProjectIds={selectedProjectIds}
        setSelectedProjectIds={setSelectedProjectIds}
        isMultiProjectTest={isMultiProjectTest}
        setIsMultiProjectTest={setIsMultiProjectTest}
      />
      
      <TestRunner
        selectedPromptIds={selectedPromptIds}
        selectedProjectIds={selectedProjectIds}
        onTestComplete={setTestResults}
        isMultiProjectTest={isMultiProjectTest}
      />
      
      {testResults && (
        <TestResults results={testResults} />
      )}
    </div>
  );
};

export default TestingTab;
