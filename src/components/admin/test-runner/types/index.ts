
export interface TestResult {
  type?: string;
  output?: string;
  finalPrompt?: string;
  promptRunId?: string;
  actionRecordId?: string;
  reminderSet?: boolean;
  nextCheckDateInfo?: any;
  usedMCP?: boolean;
  humanReviewRequestId?: string;
  knowledgeResultsCount?: number;
  error?: string;
  diagnostics?: any;
}

export interface ProjectTestResult {
  projectId: string;
  results: TestResult[];
}

export interface TestRunnerHook {
  isLoading: boolean;
  useMCP: boolean;
  error: string | null;
  setUseMCP: (value: boolean) => void;
  runTest: () => Promise<void>;
}
