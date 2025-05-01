
/**
 * Logging utilities for tools
 */

/**
 * Logs tool execution with standardized format
 */
export function logToolExecution(
  toolName: string,
  params: any,
  result: any,
  duration: number
): void {
  console.log(`[TOOL] ${toolName} executed in ${duration}ms`);
  console.log('Parameters:', JSON.stringify(params, null, 2));
  
  // Avoid logging huge result objects
  const resultLog = typeof result === 'object' 
    ? { ...result, _truncated: 'Full result object not logged' }
    : result;
    
  console.log('Result:', JSON.stringify(resultLog, null, 2));
}

/**
 * Creates a tool execution wrapper that handles timing and logging
 */
export function createToolExecutionLogger() {
  return async function executeWithLogging<T>(
    toolName: string,
    params: any,
    executeFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await executeFn();
      const duration = Date.now() - startTime;
      
      logToolExecution(toolName, params, result, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[TOOL ERROR] ${toolName} failed after ${duration}ms:`, error);
      throw error;
    }
  };
}
