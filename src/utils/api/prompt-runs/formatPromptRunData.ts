
// Update formatPromptRunData.ts to export formatRelativeTime

// Export formatRelativeTime for use in other components
export const formatRelativeTime = (date: string): string => {
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
};

export const formatPromptRunData = (data: any[]) => {
  return data.map(run => {
    // Extract project data from the join
    const project = run.projects || {};
    
    // Extract workflow prompt data
    const workflowPrompt = run.workflow_prompts || {};
    
    return {
      id: run.id,
      created_at: run.created_at,
      project_id: run.project_id,
      project_name: project.project_name,
      project_address: project.Address,
      workflow_prompt_type: workflowPrompt.type,
      workflow_type: null, // No workflow_type in schema
      error: !!run.error_message,
      error_message: run.error_message,
      reviewed: run.reviewed,
      project_crm_url: project.crm_url,
      relative_time: formatRelativeTime(run.created_at)
    };
  });
};
