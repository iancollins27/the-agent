export type WorkflowType = 'summary_generation' | 'summary_update' | 'action_detection' | 'action_execution' | 'action_detection_execution';

export type WorkflowPrompt = {
  id: string;
  type: WorkflowType;
  prompt_text: string;
};

export type Project = {
  id: string;
  summary: string | null;
  project_track: string | null;
  track_name?: string | null;
  next_step?: string | null;  // Added this field to match the database schema
  next_check_date?: string | null; // Date when the project should be checked again
};

export type TestResult = {
  projectId: string;
  results: PromptResult[];
};

export interface PromptResult {
  type: WorkflowType;
  output: string;
  finalPrompt: string;
  promptRunId?: string;
  actionRecordId?: string;
  reminderSet?: boolean;
  nextCheckDateInfo?: {
    currentValue: string | null;
    newValue: string | null;
  };
}

export const workflowTitles: Record<WorkflowType, string> = {
  summary_generation: "Summary Generation",
  summary_update: "Summary Update",
  action_detection: "Action Detection",
  action_execution: "Action Execution",
  action_detection_execution: "Action Detection & Execution"
};

export const availableVariables = {
  summary_generation: [
    { name: "track_name", description: "The name of the project track" },
    { name: "new_data", description: "The data received from CRM" },
    { name: "current_date", description: "Today's date" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" }
  ],
  summary_update: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "new_data", description: "The data received from CRM" },
    { name: "current_date", description: "Today's date" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" }
  ],
  action_detection: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "current_date", description: "Today's date" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" }
  ],
  action_execution: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "action_description", description: "The description of the action to be executed" },
    { name: "current_date", description: "Today's date" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" }
  ],
  action_detection_execution: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "current_date", description: "Today's date" },
    { name: "next_step", description: "The current next step in the project" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" },
    { name: "is_reminder_check", description: "Whether this check is from a scheduled reminder" }
  ]
};
