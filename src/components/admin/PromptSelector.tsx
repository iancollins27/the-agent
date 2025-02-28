
import { Checkbox } from "@/components/ui/checkbox";
import { WorkflowPrompt, workflowTitles } from "@/types/workflow";

type PromptSelectorProps = {
  prompts: WorkflowPrompt[] | undefined;
  selectedPrompts: string[];
  onPromptSelectionChange: (promptId: string, checked: boolean) => void;
};

const PromptSelector = ({
  prompts,
  selectedPrompts,
  onPromptSelectionChange
}: PromptSelectorProps) => {
  return (
    <div className="border rounded-lg p-4">
      {prompts?.map((prompt) => (
        <div key={prompt.id} className="flex items-center space-x-2 py-2">
          <Checkbox
            checked={selectedPrompts.includes(prompt.id)}
            onCheckedChange={(checked) => {
              onPromptSelectionChange(prompt.id, !!checked);
            }}
          />
          <span>{workflowTitles[prompt.type]}</span>
        </div>
      ))}
    </div>
  );
};

export default PromptSelector;
