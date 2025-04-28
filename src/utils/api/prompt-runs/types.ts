
// Define a type for our database result with the additional roofer_contact property
export interface PromptRunWithRoofer extends Record<string, any> {
  roofer_contact?: string | null;
}

export interface RerunPromptResult {
  success: boolean;
  newPromptRunId?: string;
  error?: string;
}
