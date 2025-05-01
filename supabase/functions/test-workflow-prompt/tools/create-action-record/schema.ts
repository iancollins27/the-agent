
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
    description: {
      type: "string",
      description: "Description of the action"
    },
    recipient: {
      type: "string",
      description: "Who should receive this action"
    },
    sender: {
      type: "string",
      description: "Who is sending this action"
    },
    message_text: {
      type: "string", 
      description: "For 'message' action type, the text of the message"
    },
    days_until_check: {
      type: "integer",
      description: "For 'set_future_reminder' action type, days until the check"
    },
    check_reason: {
      type: "string", 
      description: "For 'set_future_reminder' action type, reason for the check"
    },
    field: {
      type: "string",
      description: "For 'data_update' action type, the field to update"
    },
    value: {
      type: "string", 
      description: "For 'data_update' action type, the value to set"
    },
    decision: {
      type: "string",
      enum: ["NO_ACTION", "ACTION_NEEDED", "SET_FUTURE_REMINDER", "REQUEST_HUMAN_REVIEW"],
      description: "The decision that led to this action being created"
    }
  },
  required: ["action_type", "description"]
};
