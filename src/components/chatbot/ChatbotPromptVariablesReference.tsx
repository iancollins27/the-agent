
import React from 'react';
import { Button } from "@/components/ui/button";

// Define available variables for the chatbot system prompt
const chatbotVariables = [
  {
    name: "user_question",
    description: "The current question or message from the user"
  },
  {
    name: "project_data",
    description: "Project information when a CRM ID is mentioned"
  },
  {
    name: "knowledge_results",
    description: "Results from knowledge base searches"
  },
  {
    name: "available_tools",
    description: "List of tools available to the chatbot"
  },
  {
    name: "company_name",
    description: "The company name from the active profile"
  },
  {
    name: "current_date",
    description: "Current date in ISO format"
  }
];

interface ChatbotPromptVariablesReferenceProps {
  isEditing: boolean;
  onInsertVariable: (variable: string) => void;
}

const ChatbotPromptVariablesReference: React.FC<ChatbotPromptVariablesReferenceProps> = ({
  isEditing,
  onInsertVariable
}) => {
  return (
    <div className="bg-muted/50 p-4 rounded-md space-y-2">
      <h4 className="font-medium text-sm">Available Variables</h4>
      <div className="grid gap-2">
        {chatbotVariables.map((variable) => (
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
                onClick={() => onInsertVariable(variable.name)}
                className="text-xs"
              >
                Insert
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatbotPromptVariablesReference;
