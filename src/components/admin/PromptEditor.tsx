
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowPrompt, workflowTitles, availableVariables } from "@/types/workflow";
import { UseMutationResult } from "@tanstack/react-query";

type PromptEditorProps = {
  prompt: WorkflowPrompt;
  currentEditingId: string | null;
  onEdit: (prompt: WorkflowPrompt) => void;
  onCancel: () => void;
  updatePromptMutation: UseMutationResult<void, Error, WorkflowPrompt, unknown>;
};

const PromptEditor = ({
  prompt,
  currentEditingId,
  onEdit,
  onCancel,
  updatePromptMutation
}: PromptEditorProps) => {
  const [editingPrompt, setEditingPrompt] = useState<WorkflowPrompt | null>(null);
  const isEditing = currentEditingId === prompt.id;

  const handleEdit = () => {
    setEditingPrompt(prompt);
    onEdit(prompt);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (editingPrompt) {
      setEditingPrompt({
        ...editingPrompt,
        prompt_text: e.target.value
      });
    }
  };

  return (
    <Card key={prompt.id}>
      <CardHeader>
        <CardTitle>{workflowTitles[prompt.type]}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Variables Reference Section */}
          <div className="bg-muted/50 p-4 rounded-md space-y-2">
            <h4 className="font-medium text-sm">Available Variables</h4>
            <div className="grid gap-2">
              {availableVariables[prompt.type].map((variable) => (
                <div key={variable.name} className="text-sm">
                  <code className="bg-muted px-1 py-0.5 rounded">
                    {`{{${variable.name}}}`}
                  </code>
                  <span className="text-muted-foreground ml-2">
                    - {variable.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={editingPrompt?.prompt_text || prompt.prompt_text}
                onChange={handleChange}
                rows={5}
              />
              <div className="flex gap-2">
                <Button 
                  onClick={() => editingPrompt && updatePromptMutation.mutate(editingPrompt)}
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
          ) : (
            <div className="space-y-4">
              <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md">
                {prompt.prompt_text}
              </pre>
              <Button 
                variant="outline"
                onClick={handleEdit}
              >
                Edit Prompt
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PromptEditor;
