
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProjectSelector from "@/components/admin/ProjectSelector";
import PromptSelector from "@/components/admin/PromptSelector";

type TestSelectionProps = {
  selectedPromptIds: string[];
  setSelectedPromptIds: (ids: string[]) => void;
  selectedProjectIds: string[];
  setSelectedProjectIds: (ids: string[]) => void;
};

const TestSelection = ({ 
  selectedPromptIds, 
  setSelectedPromptIds, 
  selectedProjectIds, 
  setSelectedProjectIds 
}: TestSelectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Workflow Prompts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prompt Selection */}
        <div>
          <h3 className="text-lg font-medium mb-2">Select Prompts</h3>
          <div className="border rounded-md p-4">
            <PromptSelector 
              selectedPromptIds={selectedPromptIds} 
              setSelectedPromptIds={setSelectedPromptIds} 
            />
          </div>
        </div>
        
        {/* Project Selection Table */}
        <div>
          <h3 className="text-lg font-medium mb-2">Select Projects</h3>
          <div className="border rounded-md">
            <ProjectSelector 
              selectedProjectIds={selectedProjectIds} 
              setSelectedProjectIds={setSelectedProjectIds} 
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestSelection;
