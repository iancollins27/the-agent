
/**
 * Service for handling human-in-the-loop scenarios
 */

/**
 * Creates a human review request for a project
 * @param supabase Supabase client
 * @param projectId The project ID
 * @param promptRunId The prompt run ID
 * @param details Details about what needs human review
 * @returns The created review request
 */
export async function createHumanReviewRequest(
  supabase: any,
  projectId: string,
  promptRunId: string,
  details: {
    reason: string;
    requested_by: string;
    priority?: 'low' | 'medium' | 'high';
    context?: string;
    suggested_actions?: string[];
  }
): Promise<any> {
  try {
    console.log(`Creating human review request for project ${projectId}:`, details);
    
    // Create an action record first with type 'human_in_loop'
    const { data: actionRecord, error: actionError } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'human_in_loop',
        action_payload: {
          reason: details.reason,
          context: details.context || '',
          suggested_actions: details.suggested_actions || [],
          priority: details.priority || 'medium'
        },
        requires_approval: true,
        status: 'pending',
        message: `Human review requested: ${details.reason}`
      })
      .select()
      .single();
    
    if (actionError) {
      console.error('Error creating human review action record:', actionError);
      throw actionError;
    }
    
    console.log(`Created human review action record: ${actionRecord.id}`);
    
    // In a real implementation, we would also:
    // 1. Send notifications to appropriate human reviewers
    // 2. Create entries in a human_review_tasks table
    // 3. Set up a mechanism to resume automation once review is complete
    
    return actionRecord;
  } catch (error) {
    console.error('Error in createHumanReviewRequest:', error);
    throw error;
  }
}

/**
 * Checks if a human review is required based on project context
 * @param projectData Project data to analyze
 * @param thresholdValue A threshold value for determining if human review is needed
 * @returns Whether human review is required and the reason
 */
export function evaluateNeedForHumanReview(
  projectData: any,
  thresholdValue: number = 0.7
): { required: boolean; reason: string } {
  // This is a placeholder implementation
  // In a real implementation, we would have more sophisticated logic
  
  // Example rule: If the project has no next step defined, require human review
  if (!projectData.next_step || projectData.next_step.trim() === '') {
    return {
      required: true,
      reason: 'Project has no next step defined, human intervention required to determine path forward'
    };
  }
  
  // Example rule: If the project summary mentions specific keywords that indicate complexity
  const complexityIndicators = [
    'stuck',
    'issue',
    'problem',
    'conflict',
    'unclear',
    'uncertain',
    'confused',
    'dispute',
    'delay',
    'failed'
  ];
  
  const summaryLowerCase = (projectData.summary || '').toLowerCase();
  const matchingIndicators = complexityIndicators.filter(indicator => 
    summaryLowerCase.includes(indicator)
  );
  
  if (matchingIndicators.length >= 3) {
    return {
      required: true,
      reason: `Project summary contains multiple complexity indicators (${matchingIndicators.join(', ')}), suggesting human review may be beneficial`
    };
  }
  
  return {
    required: false,
    reason: 'Automated handling appears sufficient based on current project context'
  };
}
