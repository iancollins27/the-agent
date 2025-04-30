
import { useState } from "react";
import TestResults from "@/components/admin/TestResults";
import TestSelection from "@/components/admin/TestSelection";
import TestRunner from "@/components/admin/test-runner";
import TablePagination from './tables/TablePagination';

const ITEMS_PER_PAGE = 10;

const TestingTab = () => {
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<any>(null);
  const [isMultiProjectTest, setIsMultiProjectTest] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  const paginatedResults = testResults ? 
    testResults.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE) : 
    null;
  
  const totalPages = testResults ? Math.ceil(testResults.length / ITEMS_PER_PAGE) : 0;

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
        <div className="space-y-4">
          <TestResults results={paginatedResults} />
          
          <div className="flex justify-center mt-4">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TestingTab;
