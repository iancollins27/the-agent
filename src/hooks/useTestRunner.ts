
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { runTests, TestRunResult } from "@/services/testRunnerService";

interface UseTestRunnerProps {
  selectedPromptIds: string[];
  selectedProjectIds: string[];
  onTestComplete: (results: TestRunResult[]) => void;
  isMultiProjectTest?: boolean;
}

export const useTestRunner = ({
  selectedPromptIds,
  selectedProjectIds,
  onTestComplete,
  isMultiProjectTest = false
}: UseTestRunnerProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useMCP, setUseMCP] = useState<boolean>(false);
  const { toast } = useToast();
  
  const handleRunTest = async () => {
    if (selectedPromptIds.length === 0 || selectedProjectIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Selection Required",
        description: "Please select at least one prompt and one project to test."
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get current user information
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || 'unknown';
      
      const results = await runTests({
        selectedPromptIds,
        selectedProjectIds,
        isMultiProjectTest,
        userEmail,
        useMCP
      });
      
      onTestComplete(results);
    } catch (error) {
      console.error('Error testing prompt:', error);
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: `Error: ${error.message || "Unknown error occurred"}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    useMCP,
    setUseMCP,
    handleRunTest
  };
};
