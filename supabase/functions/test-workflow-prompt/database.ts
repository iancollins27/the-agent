
// Re-export functions from database module for backward compatibility
import {
  logPromptRun,
  updatePromptRunWithResult,
  setProjectNextCheckDate,
  setNextCheckDate,
  createActionRecord
} from "./database/index.ts";

export {
  logPromptRun,
  updatePromptRunWithResult,
  setProjectNextCheckDate,
  setNextCheckDate,
  createActionRecord
};
