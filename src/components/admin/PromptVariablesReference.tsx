
import { Button } from "@/components/ui/button";
import { availableVariables } from "@/types/workflow";

type VariablesReferenceProps = {
  promptType: string;
  isEditing: boolean;
  onInsertVariable: (variable: string) => void;
};

const PromptVariablesReference = ({
  promptType,
  isEditing,
  onInsertVariable,
}: VariablesReferenceProps) => {
  return (
    <div className="bg-muted/50 p-4 rounded-md space-y-2">
      <h4 className="font-medium text-sm">Available Variables</h4>
      <div className="grid gap-2">
        {availableVariables[promptType] && availableVariables[promptType].map((variable) => (
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

export default PromptVariablesReference;
