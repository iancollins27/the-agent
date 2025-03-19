
// Re-export functions from modularized database files
import { handleCompany } from "./db/companies.ts";
import { 
  getExistingProject, 
  getMilestoneInstructions, 
  updateProject, 
  createProject,
  setNextCheckDate
} from "./db/projects.ts";
import { getWorkflowPrompt } from "./db/workflow-prompts.ts";
import { 
  createMilestoneActionRecord, 
  createReminderActionRecord 
} from "./db/action-records.ts";

export { 
  handleCompany, 
  getExistingProject, 
  getMilestoneInstructions,
  getWorkflowPrompt,
  updateProject,
  createProject,
  setNextCheckDate,
  createMilestoneActionRecord,
  createReminderActionRecord
};
