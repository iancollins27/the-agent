/**
 * Zod schemas for MCP tool definitions
 * These mirror the JSON Schema definitions in TOOL_DEFINITIONS but use Zod
 * for proper mcp-lite compatibility
 */

import { z } from "npm:zod@3.23.8";

export const CreateActionRecordSchema = z.object({
  action_type: z.enum(['send_message', 'set_future_reminder', 'data_update', 'escalation', 'human_in_loop', 'no_action']).describe('The type of action to create'),
  priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority level of the action'),
  days_until_check: z.number().optional().describe('For reminders: how many days until the check should occur'),
  check_reason: z.string().optional().describe('For reminders: why this check is needed'),
  recipient: z.string().optional().describe('For messages: the name or role of the recipient'),
  recipient_id: z.string().optional().describe('For messages: the UUID of the recipient contact'),
  message_text: z.string().optional().describe('For messages: the message content to send'),
  description: z.string().optional().describe('Description of the action'),
  reason: z.string().optional().describe('Reason for the action'),
  data_field: z.string().optional().describe('For data updates: the field to update'),
  data_value: z.string().optional().describe('For data updates: the new value'),
  escalation_details: z.string().optional().describe('For escalations: details about the escalation')
});

export const IdentifyProjectSchema = z.object({
  query: z.string().describe('Search query to identify the project (address, project name, CRM ID, etc.)'),
  type: z.enum(['any', 'id', 'crm_id', 'name', 'address']).optional().describe("Type of search to perform. 'any' searches all fields, others are specific")
});

export const SessionManagerSchema = z.object({
  action: z.enum(['get', 'update', 'create', 'find']).describe('The action to perform on the session'),
  session_id: z.string().optional().describe('The ID of the session to get or update'),
  company_id: z.string().optional().describe('The company ID for the session'),
  project_id: z.string().optional().describe('The project ID associated with the session'),
  channel_type: z.enum(['web', 'sms', 'email']).optional().describe('The type of channel for this session'),
  channel_identifier: z.string().optional().describe('The identifier for this channel (phone number, email address)'),
  contact_id: z.string().optional().describe('The contact ID associated with this session'),
  memory_mode: z.enum(['standard', 'detailed']).optional().describe('The memory mode for this session'),
  communication_id: z.string().optional().describe('A communication ID to link to this session')
});

export const ChannelResponseSchema = z.object({
  session_id: z.string().describe('The ID of the session to send the response to'),
  message: z.string().describe('The message content to send'),
  project_id: z.string().optional().describe('Optional project ID to associate with the message')
});

export const EscalationSchema = z.object({
  reason: z.string().describe('The reason for escalating this project'),
  description: z.string().optional().describe('Detailed description of the escalation situation'),
  escalation_details: z.string().optional().describe('Additional details about what requires escalation'),
  project_id: z.string().describe('The project ID that needs escalation')
});

export const CrmReadSchema = z.object({
  resource_type: z.enum(['project', 'contact', 'activity', 'note']).describe('The type of resource to read'),
  project_id: z.string().optional().describe('Project ID to filter results'),
  crm_id: z.string().optional().describe('CRM ID of the specific resource'),
  limit: z.number().optional().describe('Maximum number of results to return')
});

export const CrmWriteSchema = z.object({
  project_id: z.string().describe('The ID of the project related to this write operation'),
  resource_type: z.enum(['project', 'task', 'note', 'contact']).describe('The type of resource to write. Use "note" to create activities/notes in the CRM.'),
  operation_type: z.enum(['create', 'update', 'delete']).describe('The operation to perform (create new, update existing, or delete)'),
  resource_id: z.string().optional().describe('For updates/deletes: The ID of the existing resource in the CRM'),
  data: z.record(z.unknown()).describe('The data to write. For notes, include "content" or "message" with the note text.'),
  requires_approval: z.boolean().optional().describe('Whether this write operation requires human approval before execution')
});

export const KnowledgeLookupSchema = z.object({
  query: z.string().describe('The search query to find relevant information'),
  limit: z.number().optional().describe('Maximum number of results to return (default: 5)')
});

export const EmailSummarySchema = z.object({
  project_id: z.string().describe('UUID of the project to summarize emails for'),
  days_lookback: z.number().optional().describe('Number of days to look back for emails if no last processed date exists (default: 7)'),
  append_mode: z.boolean().optional().describe('Whether to append to existing summary (true) or replace it (false). Default: true')
});

/**
 * Map of tool names to their Zod schemas
 */
export const TOOL_SCHEMAS: Record<string, z.ZodType> = {
  create_action_record: CreateActionRecordSchema,
  identify_project: IdentifyProjectSchema,
  session_manager: SessionManagerSchema,
  channel_response: ChannelResponseSchema,
  escalation: EscalationSchema,
  crm_read: CrmReadSchema,
  crm_write: CrmWriteSchema,
  knowledge_lookup: KnowledgeLookupSchema,
  email_summary: EmailSummarySchema
};
