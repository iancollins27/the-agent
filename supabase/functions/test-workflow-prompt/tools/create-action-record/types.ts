
/**
 * Type definitions for the create_action_record tool
 */
import { ActionDecision, ActionPriority, ActionType } from '../types.ts';

export interface ActionRecordBase {
  decision: ActionDecision;
  action_type: ActionType;
  priority?: ActionPriority;
  requires_approval?: boolean;
}

export interface MessageActionParams extends ActionRecordBase {
  action_type: 'message';
  recipient: string;
  sender?: string;
  message_text?: string;
  message?: string;
  message_content?: string;
}

export interface DataUpdateActionParams extends ActionRecordBase {
  action_type: 'data_update';
  field: string;
  value: any;
  description?: string;
}

export interface ReminderActionParams extends ActionRecordBase {
  action_type: 'set_future_reminder';
  days_until_check: number;
  check_reason: string;
  description?: string;
}

export interface HumanReviewActionParams extends ActionRecordBase {
  action_type: 'human_in_loop';
  review_reason: string;
  description?: string;
}

export type CreateActionRecordParams = 
  | MessageActionParams
  | DataUpdateActionParams
  | ReminderActionParams
  | HumanReviewActionParams;

export interface CreateActionRecordResult {
  status: 'success' | 'error';
  action_record_id?: string;
  reminderSet?: boolean;
  reminderDays?: number;
  nextCheckDate?: string;
  message?: string;
  error?: string;
}
