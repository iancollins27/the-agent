
import { Button } from "@/components/ui/button";

type PromptDisplayProps = {
  promptText: string;
  onEdit: () => void;
};

const PromptDisplay = ({ promptText, onEdit }: PromptDisplayProps) => {
  return (
    <div className="space-y-4">
      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm overflow-auto">
        {promptText}
      </pre>
      <Button 
        variant="outline"
        onClick={onEdit}
      >
        Edit Prompt
      </Button>
    </div>
  );
};

export default PromptDisplay;
