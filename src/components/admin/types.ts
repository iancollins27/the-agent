
export type PromptRun = {
  id: string;
  project_id: string | null;
  workflow_prompt_id: string | null;
  prompt_input: string;
  prompt_output: string | null;
  feedback_description: string | null;
  feedback_tags: string[] | null;
  feedback_rating: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  project_name?: string;
  workflow_prompt_type?: string;
  ai_provider?: string | null;
  ai_model?: string | null;
};
