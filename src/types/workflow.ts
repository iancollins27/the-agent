export type WorkflowType = 'summary_generation' | 'summary_update' | 'action_detection' | 
  'action_execution' | 'action_detection_execution' | 'multi_project_analysis' | 
  'multi_project_message_generation';

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
  originalPrompt?: string;
}

export type CommunicationType = 'CALL' | 'SMS' | 'EMAIL';
export type CommunicationDirection = 'inbound' | 'outbound';

export interface NormalizedCommunication {
  type: CommunicationType;
  subtype: string;
  participants: Array<{
    type: 'phone' | 'email';
    value: string;
    role?: 'caller' | 'recipient' | 'sender' | 'receiver';
  }>;
  timestamp: string;
  direction: CommunicationDirection;
  duration?: number; // in seconds
  content?: string; // message body or transcript
  recording_url?: string;
  project_id?: string;
}

export const workflowTitles: Record<WorkflowType, string> = {
  summary_generation: "Summary Generation",
  summary_update: "Summary Update",
  action_detection: "Action Detection",
  action_execution: "Action Execution",
  action_detection_execution: "Action Detection & Execution",
  multi_project_analysis: "Multi-Project Analysis",
  multi_project_message_generation: "Multi-Project Message Generation"
};

export const availableVariables = {
  summary_generation: [
    { name: "track_name", description: "The name of the project track" },
    { name: "track_roles", description: "Roles defined for the project track" },
    { name: "track_base_prompt", description: "Base prompt defined for the project track" },
    { name: "new_data", description: "The data received from CRM" },
    { name: "current_date", description: "Today's date" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" }
  ],
  summary_update: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "track_roles", description: "Roles defined for the project track" },
    { name: "track_base_prompt", description: "Base prompt defined for the project track" },
    { name: "new_data", description: "The data received from CRM" },
    { name: "current_date", description: "Today's date" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" }
  ],
  action_detection: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "track_roles", description: "Roles defined for the project track" },
    { name: "track_base_prompt", description: "Base prompt defined for the project track" },
    { name: "current_date", description: "Today's date" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" }
  ],
  action_execution: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "track_roles", description: "Roles defined for the project track" },
    { name: "track_base_prompt", description: "Base prompt defined for the project track" },
    { name: "action_description", description: "The description of the action to be executed" },
    { name: "current_date", description: "Today's date" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" }
  ],
  action_detection_execution: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "track_roles", description: "Roles defined for the project track" },
    { name: "track_base_prompt", description: "Base prompt defined for the project track" },
    { name: "current_date", description: "Today's date" },
    { name: "next_step", description: "The current next step in the project" },
    { name: "milestone_instructions", description: "Instructions from the corresponding project track milestone" },
    { name: "is_reminder_check", description: "Whether this check is from a scheduled reminder" }
  ],
  multi_project_analysis: [
    { name: "communication_type", description: "Type of communication (SMS, CALL, etc.)" },
    { name: "communication_content", description: "Content of the communication" },
    { name: "communication_participants", description: "Participants in the communication" },
    { name: "projects_data", description: "List of projects to analyze against" },
    { name: "current_date", description: "Today's date" }
  ],
  multi_project_message_generation: [
    { name: "rooferName", description: "The name of the roofer" },
    { name: "projectData", description: "Array of projects and their details" },
    { name: "current_date", description: "Today's date" }
  ]
};
