
// Re-export all database functions from their respective modules
export { 
  handleCompany,
} from './database/company.ts';

export { 
  getExistingProject,
  createProject,
  updateProject,
  findProfileByCrmId,
} from './database/project.ts';

export { 
  getMilestoneInstructions, 
  getWorkflowPrompt,
} from './database/milestone.ts';

export { 
  createMilestoneActionRecord,
  createReminderActionRecord,
  setNextCheckDate,
} from './database/action.ts';
