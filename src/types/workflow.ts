
export type WorkflowType = 'summary_generation' | 'summary_update' | 'action_detection_execution';

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
};

export type TestResult = {
  projectId: string;
  results: {
    type: WorkflowType;
    output: string;
    finalPrompt: string;
    promptRunId?: string;
    actionRecordId?: string;
  }[];
};

export const workflowTitles: Record<WorkflowType, string> = {
  summary_generation: "Summary Generation",
  summary_update: "Summary Update",
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
  action_detection_execution: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "current_date", description: "Today's date" },
    { name: "next_step", description: "The current next step in the project" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" },
    { name: "next_check_date", description: "The date when this project should be checked next (if set)" },
    { name: "days_since_last_check", description: "Number of days since the last action check" }
  ]
};
