
import { PromptRun } from "@/components/admin/types";

export interface PromptRunWithRoofer extends PromptRun {
  roofer_contact?: string;
  project_roofer_contact?: string;
}

export interface RerunPromptResult {
  success: boolean;
  newPromptRunId?: string;
  error?: string;
}

export interface ProjectTestResult {
  projectId: string;
  results: TestResult[];
}

export interface TestResult {
  type?: string;
  output?: string;
  finalPrompt?: string;
  promptRunId?: string;
  actionRecordId?: string;
  reminderSet?: boolean;
  nextCheckDateInfo?: string;
  usedMCP?: boolean;
  humanReviewRequestId?: string;
  knowledgeResultsCount?: number;
  error?: string;
  diagnostics?: any;
}
