
export type WorkflowType =
  | 'summary_generation'
  | 'summary_update'
  | 'action_detection_execution'
  | 'multi_project_analysis'
  | 'multi_project_message_generation'
  | 'mcp_orchestrator';

export const workflowTitles: Record<WorkflowType, string> = {
  summary_generation: 'Summary Generation',
  summary_update: 'Summary Update',
  action_detection_execution: 'Action Detection & Execution',
  multi_project_analysis: 'Multi-Project Analysis',
  multi_project_message_generation: 'Multi-Project Message Generation',
  mcp_orchestrator: 'MCP Orchestrator'
};

export interface WorkflowPrompt {
  id: string;
  created_at: string;
  type: WorkflowType;
  prompt_text: string;
}

type VariableDefinition = {
  name: string;
  description: string;
};

export const availableVariables: Record<WorkflowType, VariableDefinition[]> = {
  summary_generation: [
    { name: "project_data", description: "Data fetched from the CRM system" },
    { name: "initial_summary", description: "Auto-generated summary from project data" }
  ],
  summary_update: [
    { name: "project_data", description: "Data fetched from the CRM system" },
    { name: "current_summary", description: "Current project summary" },
    { name: "new_data", description: "New data for update" }
  ],
  action_detection_execution: [
    { name: "project_data", description: "Data fetched from the CRM system" },
    { name: "summary", description: "Project summary" },
    { name: "milestone_data", description: "Details about the current milestone" }
  ],
  multi_project_analysis: [
    { name: "projects", description: "Array of project data" },
    { name: "contact_id", description: "ID of the contact to analyze" }
  ],
  multi_project_message_generation: [
    { name: "projectData", description: "Combined project data and statuses" },
    { name: "rooferName", description: "Name of the roofer to address in message" }
  ],
  mcp_orchestrator: [
    { name: "summary", description: "Project summary" },
    { name: "project_id", description: "Unique identifier for the project" },
    { name: "track_name", description: "Name of the project track" },
    { name: "track_roles", description: "Roles defined for the project track" },
    { name: "track_base_prompt", description: "Base prompt defined in the project track" },
    { name: "milestone_instructions", description: "Instructions for the current milestone" },
    { name: "current_date", description: "Today's date in ISO format (YYYY-MM-DD)" },
    { name: "next_step", description: "Description of the next step in the project" },
    { name: "property_address", description: "Address of the property" },
    { name: "is_reminder_check", description: "Whether this run is a reminder check" },
    { name: "available_tools", description: "List of available tools" },
    { name: "project_contacts", description: "List of contacts associated with the project" }
  ]
} as const;
