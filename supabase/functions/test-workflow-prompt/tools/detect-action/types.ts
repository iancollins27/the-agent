
/**
 * Type definitions for the detect_action tool
 */
import { ActionDecision, ActionPriority } from '../types.ts';

export interface DetectActionParams {
  content?: string;
  project_context?: string;
  decision: ActionDecision;
  reason: string;
  priority?: ActionPriority;
  days_until_check?: number;
  check_reason?: string;
}

export interface DetectActionResult {
  decision: ActionDecision;
  reason: string;
  priority: ActionPriority;
  reminderSet: boolean;
  reminderDays?: number;
  status: 'success' | 'error';
  error?: string;
}
