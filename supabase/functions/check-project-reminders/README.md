# Project Reminder Activation Criteria

This module implements activation criteria checks for project reminders in the cron job system.

## Overview

When a reminder action is created on a cron job, it first fetches the related project from the CRM and ensures that the project meets specific activation criteria before proceeding with the action creation.

## Activation Criteria

For a project to be eligible for reminder actions, it must meet **both** of the following criteria:

### 1. Entry Criteria

```javascript
entryCheck = false;
if (recordRec.Contract_Signed != null && 
    recordRec.Roof_Install_Finalized == null && 
    recordRec.Test_Record == FALSE) {
  entryCheck = true;
}
```

This means:
- Contract must be signed (Contract_Signed is not null)
- Roof installation must not be finalized (Roof_Install_Finalized is null)
- Must not be a test record (Test_Record is FALSE)

### 2. Status Criteria

```javascript
statusCheck = false;
if (recordRec.Status != "Archived" && 
    recordRec.Status != "VOID" && 
    recordRec.Status != "Cancelled" && 
    recordRec.Status != "Canceled") {
  statusCheck = true;
}
```

This means the project status must not be any of:
- "Archived"
- "VOID"
- "Cancelled"
- "Canceled"

## Implementation

The activation criteria check has been implemented in the following files:

1. `/check-project-reminders/utils/activationCriteria.ts` - Main implementation of the criteria check
2. `/check-project-reminders/index.ts` - Updated to check criteria before processing reminders
3. `/process-zoho-webhook/database/action.ts` - Updated createReminderActionRecord to check criteria
4. `/test-workflow-prompt/database/handlers/reminderHandler.ts` - Updated handleFutureReminder to check criteria
5. `/agent-chat/action-processor.ts` - Updated processActionRequest to check criteria for reminder actions
6. `/agent-chat/tools/create-action-record/index.ts` - Updated create_action_record tool to check criteria

## Testing

Unit tests for the activation criteria are available in:
- `/check-project-reminders/utils/activationCriteria.test.ts`

## Behavior

If a project does not meet the activation criteria:
1. The reminder action will not be created
2. A log message will be recorded explaining why the action was skipped
3. In some implementations, a "skipped" status will be returned
4. The project's last_action_check date will still be updated to prevent repeated checks

## Error Handling

If there's an error fetching CRM data to check the criteria:
1. The system will log a warning
2. In most implementations, it will fall back to creating the reminder action
3. This ensures reminders aren't lost due to temporary API issues
