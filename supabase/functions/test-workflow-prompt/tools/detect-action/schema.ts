
/**
 * Schema definition for detect-action tool
 */

export const detectActionSchema = {
  type: "object",
  properties: {
    decision: {
      type: "string",
      enum: ["NO_ACTION", "ACTION_NEEDED", "SET_FUTURE_REMINDER", "REQUEST_HUMAN_REVIEW"],
      description: "The decision on what action is needed"
    },
    reason: {
      type: "string",
      description: "Reason for the decision"
    },
    priority: {
      type: "string",
      enum: ["low", "medium", "high", "urgent"],
      description: "Priority of the action"
    },
    days_until_check: {
      type: "integer",
      description: "If SET_FUTURE_REMINDER is selected, how many days until the check should occur"
    }
  },
  required: ["decision", "reason"]
};
