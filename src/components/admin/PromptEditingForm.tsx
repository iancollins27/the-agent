
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { WorkflowPrompt, WorkflowType } from "@/types/workflow";
import { UseMutationResult } from "@tanstack/react-query";
import PromptTemplateHelper from "./PromptTemplateHelper";

type PromptEditingFormProps = {
  editingPrompt: WorkflowPrompt;
  onCancel: () => void;
  onChange: (text: string) => void;
  updatePromptMutation: UseMutationResult<void, Error, WorkflowPrompt, unknown>;
};

const PromptEditingForm = ({
  editingPrompt,
  onCancel,
  onChange,
  updatePromptMutation
}: PromptEditingFormProps) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleApplyTemplate = (template: string) => {
    onChange(template);
  };

  const handleSave = () => {
    updatePromptMutation.mutate(editingPrompt);
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={editingPrompt.prompt_text}
        onChange={handleChange}
        rows={10}
      />
      
      <PromptTemplateHelper 
        promptType={editingPrompt.type as WorkflowType}
        onApplyTemplate={handleApplyTemplate}
      />
      
      <div className="flex gap-2">
        <Button 
          onClick={handleSave}
          disabled={updatePromptMutation.isPending}
        >
          {updatePromptMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        <Button 
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default PromptEditingForm;
