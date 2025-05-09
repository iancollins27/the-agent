
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Database } from "../types.ts";

// Initialize the Supabase client
const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL") as string,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string
);

interface ActionRecordParams {
  action_type: string;
  project_id?: string;
  message?: string;
  recipient_id?: string;
  requires_approval?: boolean;
  action_payload: Record<string, any>;
  sender_ID?: string;
  sender_phone?: string;
}

/**
 * Create an action record in the database
 * @returns The ID of the newly created action record, or null if creation failed
 */
export async function createActionRecord(params: ActionRecordParams): Promise<string | null> {
  // Set default values
  const requiresApproval = params.requires_approval ?? true;

  try {
    const { data: actionRecord, error } = await supabase
      .from("action_records")
      .insert({
        action_type: params.action_type,
        project_id: params.project_id || null,
        message: params.message || null,
        recipient_id: params.recipient_id || null,
        requires_approval: requiresApproval,
        action_payload: params.action_payload,
        status: requiresApproval ? "pending" : "approved",
        sender_ID: params.sender_ID || null,
        sender_phone: params.sender_phone || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating action record:", error);
      return null;
    }

    return actionRecord?.id || null;
  } catch (error) {
    console.error("Error creating action record:", error);
    return null;
  }
}

interface ReminderParams {
  projectId: string;
  daysUntilCheck: number;
  checkReason: string;
  requiresApproval?: boolean;
}

/**
 * Create a reminder action record
 */
export async function createReminder(params: ReminderParams): Promise<string | null> {
  return createActionRecord({
    action_type: "set_future_reminder",
    project_id: params.projectId,
    requires_approval: params.requiresApproval ?? true,
    action_payload: {
      days_until_check: params.daysUntilCheck,
      check_reason: params.checkReason,
    },
    message: `Set a reminder to check this project in ${params.daysUntilCheck} days: ${params.checkReason}`
  });
}

interface CrmWriteParams {
  projectId: string;
  resourceType: 'project' | 'task' | 'note' | 'contact';
  operationType: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  resourceId?: string;
  companyId: string;
  requiresApproval?: boolean;
}

/**
 * Create a CRM write action record
 */
export async function createCrmWriteAction(params: CrmWriteParams): Promise<string | null> {
  return createActionRecord({
    action_type: "crm_write",
    project_id: params.projectId,
    requires_approval: params.requiresApproval ?? true,
    action_payload: {
      resource_type: params.resourceType,
      operation_type: params.operationType,
      resource_id: params.resourceId,
      data: params.data,
      company_id: params.companyId,
      description: `${params.operationType.charAt(0).toUpperCase() + params.operationType.slice(1)} ${params.resourceType} in CRM`
    },
    message: `${params.operationType.charAt(0).toUpperCase() + params.operationType.slice(1)} ${params.resourceType} in CRM with the following data: ${JSON.stringify(params.data)}`
  });
}
