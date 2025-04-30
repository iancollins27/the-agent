
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleMessageAction } from "./messageActionHandler.ts";
import { handleOtherActionTypes } from "./otherActionHandler.ts";

/**
 * Handle the ACTION_NEEDED decision type
 */
export async function handleActionNeeded(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any
) {
  // Extract action type from response or default to message
  const actionType = actionData.action_type || "message";
  
  console.log("Action type detected:", actionType);
  
  // Get the company ID from the project
  let companyId = null;
  try {
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('company_id')
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error("Error fetching project:", projectError);
    } else {
      companyId = projectData.company_id;
      console.log("Found company ID:", companyId);
    }
  } catch (error) {
    console.error("Error getting company ID:", error);
  }
  
  // Handle different action types and formats
  if (actionType === "message") {
    return await handleMessageAction(supabase, promptRunId, projectId, actionData);
  } else {
    return await handleOtherActionTypes(supabase, promptRunId, projectId, actionData, actionType);
  }
}
