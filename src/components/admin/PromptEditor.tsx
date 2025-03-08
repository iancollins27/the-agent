
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowPrompt, workflowTitles } from "@/types/workflow";
import { UseMutationResult } from "@tanstack/react-query";
import PromptVariablesReference from "./PromptVariablesReference";
import PromptEditingForm from "./PromptEditingForm";
import PromptDisplay from "./PromptDisplay";

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

  const handlePromptChange = (text: string) => {
    if (editingPrompt) {
      setEditingPrompt({
        ...editingPrompt,
        prompt_text: text
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

  return (
    <Card key={prompt.id}>
      <CardHeader>
        <CardTitle>{workflowTitles[prompt.type]}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <PromptVariablesReference 
            promptType={prompt.type}
            isEditing={isEditing}
            onInsertVariable={insertVariable}
          />

          {isEditing ? (
            <PromptEditingForm 
              editingPrompt={editingPrompt || prompt}
              onCancel={onCancel}
              onChange={handlePromptChange}
              updatePromptMutation={updatePromptMutation}
            />
          ) : (
            <PromptDisplay 
              promptText={prompt.prompt_text}
              onEdit={handleEdit}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PromptEditor;
