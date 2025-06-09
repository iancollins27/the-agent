
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleMessageAction } from "./messageActionHandler.ts";
import { handleOtherActionTypes } from "./otherActionHandler.ts";

/**
 * Handle the ACTION_NEEDED decision type (Legacy support - MCP is now preferred)
 * This handler remains for backward compatibility with existing workflows
 */
export async function handleActionNeeded(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any
) {
  console.log("Note: Using legacy action handler. Consider migrating to MCP workflow.");
  
  // Extract action type from response or default to message
  let actionType = actionData.action_type || "message";
  
  // Normalize action type to match database constraints
  switch (actionType.toLowerCase()) {
    case "communication":
    case "contact":
    case "schedule":
    case "schedule site visit":
    case "send message":
      actionType = "message";
      break;
    case "reminder":
    case "set reminder":
      actionType = "set_future_reminder";
      break;
    case "update data":
    case "change data":
      actionType = "data_update";
      break;
    case "human review":
    case "ask human":
      actionType = "human_in_loop";
      break;
    case "search knowledge":
    case "query knowledge":
      actionType = "knowledge_query";
      break;
    default:
      // Keep as is if it already matches a valid type
      break;
  }

  // Update the action_type in actionData
  actionData.action_type = actionType;
  
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
