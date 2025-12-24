/**
 * Tool Edge Function: create-action-record
 * Creates action records based on AI analysis
 * 
 * Used by: test-workflow-prompt, agent-chat
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  ToolRequest,
  ToolResponse,
  ToolSecurityContext,
  validateSecurityContext,
  successResponse,
  errorResponse
} from '../_shared/tool-types/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateActionRecordArgs {
  action_type: string;
  priority?: string;
  days_until_check?: number;
  check_reason?: string;
  recipient?: string;
  recipient_id?: string;
  message?: string;
  message_text?: string;
  description?: string;
  reason?: string;
  data_field?: string;
  data_value?: string;
  escalation_details?: string;
  channel?: string;
  project_id?: string;
  prompt_run_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { securityContext, args, metadata }: ToolRequest<CreateActionRecordArgs> = await req.json();
    
    console.log(`tool-create-action-record called by ${metadata?.orchestrator || 'unknown'}`);
    console.log(`Security context: company_id=${securityContext?.company_id}, user_type=${securityContext?.user_type}`);
    
    // 1. Validate security context
    const validation = validateSecurityContext(securityContext);
    if (!validation.valid) {
      console.error(`Security validation failed: ${validation.error}`);
      return new Response(
        JSON.stringify(errorResponse(validation.error!, 'Security validation failed')),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 2. Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // 3. Resolve project ID
    const projectId = securityContext.project_id || args.project_id;
    if (!projectId) {
      return new Response(
        JSON.stringify(errorResponse('Project ID is required', 'Missing project_id in security context or args')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 4. Verify project belongs to company (security check)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, company_id, project_name')
      .eq('id', projectId)
      .single();
      
    if (projectError || !project) {
      console.error('Project not found:', projectError);
      return new Response(
        JSON.stringify(errorResponse('Project not found', `Project ${projectId} does not exist`)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (project.company_id !== securityContext.company_id) {
      console.error(`Security violation: Project ${projectId} belongs to company ${project.company_id}, not ${securityContext.company_id}`);
      return new Response(
        JSON.stringify(errorResponse('Access denied', 'You do not have permission to access this project')),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 5. Execute tool logic
    const result = await createActionRecord(
      supabase,
      securityContext,
      projectId,
      args,
      metadata?.prompt_run_id
    );
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Tool error:', error);
    return new Response(
      JSON.stringify(errorResponse(error.message || 'An unexpected error occurred')),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Main function to create action records
 */
async function createActionRecord(
  supabase: ReturnType<typeof createClient>,
  securityContext: ToolSecurityContext,
  projectId: string,
  args: CreateActionRecordArgs,
  promptRunId?: string
): Promise<ToolResponse> {
  try {
    const actionType = normalizeActionType(args.action_type);
    console.log(`Creating ${actionType} action for project ${projectId}`);
    
    if (actionType === 'message' || actionType === 'send_message') {
      return await handleMessageAction(supabase, projectId, args, promptRunId);
    }
    
    return await handleOtherActionTypes(supabase, projectId, args, actionType, promptRunId);
  } catch (error) {
    console.error('Error in createActionRecord:', error);
    return errorResponse(error.message || 'Failed to create action record');
  }
}

/**
 * Normalize action type to consistent format
 */
function normalizeActionType(actionType: string): string {
  const type = actionType?.toLowerCase()?.trim() || 'message';
  
  // Map common variations
  const typeMap: Record<string, string> = {
    'send_message': 'message',
    'sendmessage': 'message',
    'reminder': 'set_future_reminder',
    'set_reminder': 'set_future_reminder',
    'future_reminder': 'set_future_reminder',
    'update_data': 'data_update',
    'dataupdate': 'data_update',
    'escalate': 'escalation',
    'human': 'human_in_loop',
    'no_action_needed': 'no_action',
    'none': 'no_action'
  };
  
  return typeMap[type] || type;
}

/**
 * Handle message action type
 */
async function handleMessageAction(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  args: CreateActionRecordArgs,
  promptRunId?: string
): Promise<ToolResponse> {
  // Resolve recipient ID
  let recipientId = args.recipient_id || null;
  if (!recipientId && args.recipient) {
    recipientId = await findContactByNameOrRole(supabase, args.recipient, projectId);
  }
  
  if (!recipientId) {
    return errorResponse(`Could not find recipient: ${args.recipient || 'No recipient specified'}`);
  }
  
  // Get message content
  const messageContent = args.message || args.message_text || '';
  if (!messageContent) {
    return errorResponse('No message content provided');
  }
  
  // Build action payload with agent-as-sender model
  const actionPayload = {
    message: messageContent,
    recipient_id: recipientId,
    sender_type: 'agent',
    priority: args.priority || 'medium',
    channel: args.channel || 'sms'
  };
  
  // Create the action record
  const { data: actionRecord, error: insertError } = await supabase
    .from('action_records')
    .insert({
      project_id: projectId,
      prompt_run_id: promptRunId || null,
      action_type: 'message',
      action_payload: actionPayload,
      message: messageContent,
      recipient_id: recipientId,
      status: 'pending',
      requires_approval: true
    })
    .select('id')
    .single();
    
  if (insertError) {
    console.error('Error inserting action record:', insertError);
    return errorResponse(`Failed to create action record: ${insertError.message}`);
  }
  
  console.log('Created message action record:', actionRecord.id);
  return successResponse(
    { action_record_id: actionRecord.id },
    'Created message action record'
  );
}

/**
 * Handle other action types (data_update, set_future_reminder, etc.)
 */
async function handleOtherActionTypes(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  args: CreateActionRecordArgs,
  actionType: string,
  promptRunId?: string
): Promise<ToolResponse> {
  // Build action payload based on type
  const actionPayload: Record<string, unknown> = {
    action_type: actionType,
    priority: args.priority || 'medium'
  };
  
  let reminderDate: string | null = null;
  
  switch (actionType) {
    case 'data_update':
      actionPayload.data_field = args.data_field;
      actionPayload.data_value = args.data_value;
      actionPayload.description = args.description;
      break;
      
    case 'set_future_reminder':
      actionPayload.days_until_check = args.days_until_check;
      actionPayload.check_reason = args.check_reason || args.reason;
      if (args.days_until_check) {
        const date = new Date();
        date.setDate(date.getDate() + args.days_until_check);
        reminderDate = date.toISOString();
        actionPayload.reminder_date = reminderDate;
      }
      break;
      
    case 'escalation':
      actionPayload.escalation_details = args.escalation_details;
      actionPayload.reason = args.reason;
      break;
      
    case 'human_in_loop':
      actionPayload.description = args.description;
      actionPayload.reason = args.reason;
      break;
      
    case 'no_action':
      // No action needed - just log it
      return successResponse(
        { action_type: 'no_action' },
        'No action required'
      );
      
    default:
      actionPayload.description = args.description;
      actionPayload.reason = args.reason;
  }
  
  // Create the action record
  const { data: actionRecord, error: insertError } = await supabase
    .from('action_records')
    .insert({
      project_id: projectId,
      prompt_run_id: promptRunId || null,
      action_type: actionType,
      action_payload: actionPayload,
      message: args.description || args.reason || null,
      reminder_date: reminderDate,
      status: 'pending',
      requires_approval: actionType !== 'set_future_reminder'
    })
    .select('id')
    .single();
    
  if (insertError) {
    console.error('Error inserting action record:', insertError);
    return errorResponse(`Failed to create action record: ${insertError.message}`);
  }
  
  console.log(`Created ${actionType} action record:`, actionRecord.id);
  return successResponse(
    { action_record_id: actionRecord.id },
    `Created ${actionType} action record`
  );
}

/**
 * Find a contact by name or role within a project
 */
async function findContactByNameOrRole(
  supabase: ReturnType<typeof createClient>,
  nameOrRole: string,
  projectId?: string
): Promise<string | null> {
  try {
    if (!nameOrRole) return null;
    
    const searchTerm = nameOrRole.toLowerCase().trim();
    console.log(`Looking up contact: "${nameOrRole}" for project: ${projectId}`);
    
    // If we have a project ID, search within project contacts first
    if (projectId) {
      const { data: projectContacts, error: pcError } = await supabase
        .from('project_contacts')
        .select('contact_id')
        .eq('project_id', projectId);
        
      if (!pcError && projectContacts && projectContacts.length > 0) {
        const contactIds = projectContacts.map((pc: { contact_id: string }) => pc.contact_id);
        
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, full_name, role, email')
          .in('id', contactIds);
          
        if (!contactsError && contacts) {
          // Try exact name match
          const exactMatch = contacts.find((c: { full_name?: string }) => 
            c.full_name?.toLowerCase() === searchTerm
          );
          if (exactMatch) {
            console.log(`Found exact name match: ${exactMatch.id}`);
            return exactMatch.id;
          }
          
          // Try role match
          const roleMatch = contacts.find((c: { role?: string }) => 
            c.role?.toLowerCase() === searchTerm ||
            c.role?.toLowerCase().includes(searchTerm) ||
            searchTerm.includes(c.role?.toLowerCase() || '')
          );
          if (roleMatch) {
            console.log(`Found role match: ${roleMatch.id}`);
            return roleMatch.id;
          }
          
          // Try partial name match
          const partialMatch = contacts.find((c: { full_name?: string }) =>
            c.full_name?.toLowerCase().includes(searchTerm) ||
            searchTerm.includes(c.full_name?.toLowerCase() || '')
          );
          if (partialMatch) {
            console.log(`Found partial name match: ${partialMatch.id}`);
            return partialMatch.id;
          }
        }
      }
    }
    
    // Fallback: global search by name or role
    const { data: globalContacts, error: globalError } = await supabase
      .from('contacts')
      .select('id, full_name, role')
      .or(`full_name.ilike.%${searchTerm}%,role.ilike.%${searchTerm}%`)
      .limit(1);
      
    if (!globalError && globalContacts && globalContacts.length > 0) {
      console.log(`Found global match: ${globalContacts[0].id}`);
      return globalContacts[0].id;
    }
    
    console.log(`No contact found for: ${nameOrRole}`);
    return null;
  } catch (error) {
    console.error('Error in findContactByNameOrRole:', error);
    return null;
  }
}
