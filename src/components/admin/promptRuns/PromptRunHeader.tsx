
import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';

interface PromptRunHeaderProps {
  projectName: string;
  onBackClick: () => void;
}

const PromptRunHeader: React.FC<PromptRunHeaderProps> = ({ 
  projectName,
  onBackClick
}) => {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Button 
        variant="outline" 
        size="icon"
        onClick={onBackClick}
        title="Back to all prompt runs"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      
      <div>
        <h1 className="text-2xl font-bold">{projectName}</h1>
        <p className="text-sm text-muted-foreground">Prompt run history</p>
      </div>
    </div>
  );
};

export default PromptRunHeader;
