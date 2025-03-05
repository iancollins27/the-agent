
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { workflowTitles } from "@/types/workflow";
import { Loader2 } from "lucide-react";

type PromptSelectorProps = {
  selectedPromptIds: string[];
  setSelectedPromptIds: (ids: string[]) => void;
};

const PromptSelector = ({ selectedPromptIds, setSelectedPromptIds }: PromptSelectorProps) => {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchPrompts = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('workflow_prompts')
        .select('id, type')
        .order('type');
        
      if (error) {
        console.error('Error fetching prompts:', error);
      } else {
        setPrompts(data || []);
      }
      setIsLoading(false);
    };
    
    fetchPrompts();
  }, []);
  
  const handlePromptToggle = (promptId: string) => {
    if (selectedPromptIds.includes(promptId)) {
      setSelectedPromptIds(selectedPromptIds.filter(id => id !== promptId));
    } else {
      setSelectedPromptIds([...selectedPromptIds, promptId]);
    }
  };
  
  return (
    <div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading prompts...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md">
              <Checkbox 
                id={`prompt-${prompt.id}`} 
                checked={selectedPromptIds.includes(prompt.id)}
                onCheckedChange={() => handlePromptToggle(prompt.id)}
              />
              <Label htmlFor={`prompt-${prompt.id}`} className="flex-1 cursor-pointer">
                {workflowTitles[prompt.type] || prompt.type}
              </Label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptSelector;
