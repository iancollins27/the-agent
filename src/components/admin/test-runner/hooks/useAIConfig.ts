
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch AI provider configuration
 */
export const useAIConfig = () => {
  // Get current AI configuration from the database
  const getAIConfig = async () => {
    try {
      const { data: aiConfig, error: aiConfigError } = await supabase
        .from('ai_config')
        .select('provider, model')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (aiConfigError) {
        console.error("Error fetching AI config:", aiConfigError);
        return {
          aiProvider: 'openai',
          aiModel: 'gpt-4o'
        };
      }
      
      return {
        aiProvider: aiConfig?.provider || 'openai',
        aiModel: aiConfig?.model || 'gpt-4o'
      };
    } catch (error) {
      console.error("Error in getAIConfig:", error);
      return {
        aiProvider: 'openai',
        aiModel: 'gpt-4o'
      };
    }
  };

  return { getAIConfig };
};
