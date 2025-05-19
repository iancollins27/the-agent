
import { ToolContext } from '../../tools/types.ts';

interface EmailSummaryArgs {
  project_id: string;
  days_lookback?: number;
  append_mode?: boolean;
}

export async function executeEmailSummaryFunction(args: EmailSummaryArgs, context: ToolContext) {
  const { project_id, days_lookback = 7, append_mode = true } = args;
  const { supabase, companyId } = context;
  
  if (!companyId) {
    console.error('Company ID is required for email summary tool');
    return {
      status: 'error',
      error: 'Missing company ID',
      message: 'Company ID is required for security'
    };
  }
  
  try {
    console.log(`Executing email summary function for project ${project_id} and company ${companyId}`);
    
    // First verify the project belongs to the company for security
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, company_id')
      .eq('id', project_id)
      .single();
    
    if (projectError) {
      console.error('Error fetching project:', projectError);
      return {
        status: 'error',
        error: projectError.message,
        message: 'Failed to verify project access'
      };
    }
    
    if (projectData.company_id !== companyId) {
      console.error(`Security error: Project ${project_id} does not belong to company ${companyId}`);
      return {
        status: 'error',
        error: 'Access denied',
        message: 'You do not have permission to access this project'
      };
    }
    
    // Call the email-summary edge function
    const response = await supabase.functions.invoke('email-summary', {
      body: {
        project_id,
        company_id: companyId,
        days_lookback,
        append_mode
      }
    });
    
    if (response.error) {
      console.error('Error from email-summary function:', response.error);
      return {
        status: 'error',
        error: response.error,
        message: 'Failed to process email summary'
      };
    }
    
    return {
      status: 'success',
      ...response.data
    };
  } catch (error) {
    console.error('Exception calling email-summary function:', error);
    return {
      status: 'error',
      error: error.message || 'Unknown error',
      message: 'Exception while processing email summary'
    };
  }
}
