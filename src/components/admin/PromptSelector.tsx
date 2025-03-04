
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { workflowTitles } from "@/types/workflow";
import { Loader2 } from "lucide-react";

type PromptSelectorProps = {
  selectedPromptId: string | null;
  setSelectedPromptId: (id: string | null) => void;
};

const PromptSelector = ({ selectedPromptId, setSelectedPromptId }: PromptSelectorProps) => {
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
  
  return (
    <div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading prompts...</span>
        </div>
      ) : (
        <Select 
          value={selectedPromptId || ''} 
          onValueChange={(value) => setSelectedPromptId(value || null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a prompt" />
          </SelectTrigger>
          <SelectContent>
            {prompts.map((prompt) => (
              <SelectItem key={prompt.id} value={prompt.id}>
                {workflowTitles[prompt.type] || prompt.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default PromptSelector;
