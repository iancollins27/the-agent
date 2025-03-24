
import React from "react";

type PromptDisplayProps = {
  promptText: string;
  onEdit: () => void;
};

const PromptDisplay = ({ promptText }: PromptDisplayProps) => {
  return (
    <div className="space-y-4">
      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm overflow-auto">
        {promptText}
      </pre>
    </div>
  );
};

export default PromptDisplay;
