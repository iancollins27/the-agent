
import { PromptRun } from "@/components/admin/types";
import { formatDistanceToNow } from 'date-fns';

export const formatPromptRunData = (data: any[]): PromptRun[] => {
  return data.map((item) => {
    // Extract project details if available
    const projectData = item.projects || {};
    const workflowPromptData = item.workflow_prompts || {};
    
    // Format the data into our PromptRun shape
    const formattedData: PromptRun = {
      id: item.id,
      created_at: item.created_at,
      status: item.status,
      ai_provider: item.ai_provider,
      ai_model: item.ai_model,
      prompt_input: item.prompt_input,
      prompt_output: item.prompt_output,
      error_message: item.error_message,
      feedback_rating: item.feedback_rating,
      feedback_description: item.feedback_description,
      feedback_tags: item.feedback_tags,
      completed_at: item.completed_at,
      reviewed: item.reviewed || false,
      project_id: item.project_id,
      workflow_prompt_id: item.workflow_prompt_id,
      workflow_prompt_type: workflowPromptData?.type || null,
      
      // Project related data
      project_name: projectData.crm_id || null,
      project_address: projectData.Address || null,
      project_next_step: projectData.next_step || null,
      
      // Calculate relative time for display
      relative_time: item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : 'Unknown',
      
      // Set workflow type
      workflow_type: workflowPromptData?.type || null
    };
    
    return formattedData;
  });
};

// Add the formatRelativeTime function that was referenced but missing
export const formatRelativeTime = (date: string): string => {
  try {
    const now = new Date();
    const promptDate = new Date(date);
    const diffMs = now.getTime() - promptDate.getTime();

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  } catch (error) {
    return 'Unknown time';
  }
};
