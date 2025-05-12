
/**
 * Schema definition for create-action-record tool
 */

export const createActionRecordSchema = {
  type: "object",
  properties: {
    action_type: {
      type: "string",
      enum: ["message", "data_update", "set_future_reminder", "human_in_loop", "knowledge_query"],
      description: "The type of action to create"
    },
    decision: {
      type: "string",
      enum: ["ACTION_NEEDED", "NO_ACTION", "SET_FUTURE_REMINDER", "REQUEST_HUMAN_REVIEW"],
      description: "The decision made by the orchestrator (included for backwards compatibility)"
    },
    priority: {
      type: "string",
      enum: ["low", "medium", "high", "urgent"],
      description: "Priority of the action"
    },
    days_until_check: {
      type: "integer",
      description: "If SET_FUTURE_REMINDER is selected, how many days until the check should occur"
    },
    check_reason: {
      type: "string",
      description: "If SET_FUTURE_REMINDER is selected, why the check should occur"
    },
    sender: {
      type: "string",
      description: "For message actions, who is sending the message (e.g. BidList Project Manager)"
    },
    sender_ID: {
      type: "string",
      description: "UUID of the sender contact (preferred over sender name)"
    },
    recipient: {
      type: "string",
      description: "For message actions, who should receive the message (e.g. Homeowner, Solar Rep, Roofer)"
    },
    recipient_id: {
      type: "string",
      description: "UUID of the recipient contact (preferred over recipient name)"
    },
    message: {
      type: "string",
      description: "For message actions, the content of the message"
    },
    message_text: {
      type: "string",
      description: "Alternative field for message content (for backward compatibility)"
    },
    description: {
      type: "string",
      description: "A brief description of the action"
    },
    reason: {
      type: "string",
      description: "Reason for the action or decision"
    },
    data_field: {
      type: "string",
      description: "For data_update actions, the field to update"
    },
    data_value: {
      type: "string",
      description: "For data_update actions, the new value for the field"
    }
  },
  required: ["action_type"]
};
