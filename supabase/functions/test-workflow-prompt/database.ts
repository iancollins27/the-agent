
// Re-export functions from database module for backward compatibility
import {
  logPromptRun,
  updatePromptRunWithResult
} from "./database/prompt-runs.ts";

import {
  setProjectNextCheckDate,
  setNextCheckDate
} from "./database/projects.ts";

import {
  createActionRecord
} from "./database/actions.ts";

export {
  logPromptRun,
  updatePromptRunWithResult,
  setProjectNextCheckDate,
  setNextCheckDate,
  createActionRecord
};
