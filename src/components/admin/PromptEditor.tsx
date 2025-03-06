
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

  const insertVariable = (variable: string) => {
    if (editingPrompt) {
      const textArea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textArea) {
        const cursorPos = textArea.selectionStart;
        const textBefore = editingPrompt.prompt_text.substring(0, cursorPos);
        const textAfter = editingPrompt.prompt_text.substring(cursorPos);
        
        const newText = `${textBefore}{{${variable}}}${textAfter}`;
        setEditingPrompt({
          ...editingPrompt,
          prompt_text: newText
        });
        
        // Set cursor position after the inserted variable
        setTimeout(() => {
          textArea.focus();
          const newCursorPos = cursorPos + variable.length + 4; // +4 for the {{ and }}
          textArea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    }
  };

  // Helper function to provide a default prompt template
  const getSuggestedPromptTemplate = () => {
    if (prompt.type === 'summary_update') {
      return `You are an AI assistant tasked with updating a project summary with new information.

Current Project Summary:
{{summary}}

Project Track: {{track_name}}

New Information:
{{new_data}}

Today's Date: {{current_date}}

Milestone Instructions:
{{milestone_instructions}}

Instructions:
1. Review the current project summary
2. Integrate the new information provided
3. Follow any specific milestone instructions above
4. Maintain a professional tone and clarity
5. Keep the updated summary comprehensive but concise
6. Include key dates, actions, and relevant stakeholders
7. Preserve any critical historical information from the original summary
8. Ensure the updated summary provides a complete picture of the project status

Please provide an updated project summary that incorporates the new information while maintaining the context and structure of the original summary.`;
    } else if (prompt.type === 'action_detection_execution') {
      return `You are an AI assistant responsible for analyzing project details and determining if any automated actions should be taken.

Current Project Summary:
{{summary}}

Project Track: {{track_name}}

Next Step: {{next_step}}

Today's Date: {{current_date}}

Milestone Instructions:
{{milestone_instructions}}

Instructions:
1. Review the current project summary and next step information
2. Determine if any action should be taken based on the project status
3. Your response must be a JSON object in one of these formats:

IF ACTION IS NEEDED:
{
  "decision": "ACTION_NEEDED",
  "reason": "Explanation for your decision",
  "action_type": "message" | "data_update" | "request_for_data_update",
  "message_text": "The message you want to send", (only if action type is message)
  "action_payload": {
    // Additional data needed for the action, including the message and reason if action type is message
  }
}

IF NO IMMEDIATE ACTION BUT FUTURE CHECK NEEDED:
{
  "decision": "SET_FUTURE_REMINDER",
  "reason": "Explanation why a future check is needed",
  "action_type": "set_future_reminder",
  "days_until_check": 7, // Number of days until the next check (adjust as needed)
  "check_reason": "Reason to check again in the future",
  "action_payload": {
    "description": "Set reminder to check in X days: reason"
  }
}

IF NO ACTION IS NEEDED:
{
  "decision": "NO_ACTION",
  "reason": "Explanation why no action is needed"
}

The system will automatically execute your decision. If you choose ACTION_NEEDED, action records will be created. If you choose SET_FUTURE_REMINDER, the project's next_check_date will be updated.`;
    }
    return null;
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
                <div key={variable.name} className="text-sm flex items-center justify-between">
                  <div>
                    <code className="bg-muted px-1 py-0.5 rounded">
                      {`{{${variable.name}}}`}
                    </code>
                    <span className="text-muted-foreground ml-2">
                      - {variable.description}
                    </span>
                  </div>
                  {isEditing && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => insertVariable(variable.name)}
                      className="text-xs"
                    >
                      Insert
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={editingPrompt?.prompt_text || prompt.prompt_text}
                onChange={handleChange}
                rows={10}
              />
              
              {/* Add suggested templates for different prompt types */}
              {(prompt.type === 'summary_update' || prompt.type === 'action_detection_execution') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const template = getSuggestedPromptTemplate();
                    if (template && editingPrompt) {
                      setEditingPrompt({
                        ...editingPrompt,
                        prompt_text: template
                      });
                    }
                  }}
                  className="mb-2"
                >
                  Use Suggested Template
                </Button>
              )}
              
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
              <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm overflow-auto">
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
