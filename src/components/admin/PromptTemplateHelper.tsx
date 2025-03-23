
import { Button } from "@/components/ui/button";
import { WorkflowType } from "@/types/workflow";

type PromptTemplateHelperProps = {
  promptType: WorkflowType;
  onApplyTemplate: (template: string) => void;
};

const PromptTemplateHelper = ({ promptType, onApplyTemplate }: PromptTemplateHelperProps) => {
  // Helper function to provide a default prompt template
  const getSuggestedPromptTemplate = () => {
    if (promptType === 'summary_update') {
      return `You are an AI assistant tasked with updating a project summary with new information.

Current Project Summary:
{{summary}}

Project Track: {{track_name}}

New Information:
{{new_data}}

Today's Date: {{current_date}}

Milestone Instructions:
{{milestone_instructions}}

Instructions:
1. Review the current project summary
2. Integrate the new information provided
3. Follow any specific milestone instructions above
4. Maintain a professional tone and clarity
5. Keep the updated summary comprehensive but concise
6. Include key dates, actions, and relevant stakeholders
7. Preserve any critical historical information from the original summary
8. Ensure the updated summary provides a complete picture of the project status

Please provide an updated project summary that incorporates the new information while maintaining the context and structure of the original summary.`;
    } else if (promptType === 'action_detection_execution') {
      return `You are an AI assistant responsible for analyzing project details and determining if any automated actions should be taken.

Current Project Summary:
{{summary}}

Project Track: {{track_name}}

Next Step: {{next_step}}

Today's Date: {{current_date}}

Milestone Instructions:
{{milestone_instructions}}

Is this a reminder check? {{is_reminder_check}}

Instructions:
1. Review the current project summary and next step information
2. Determine if any action should be taken based on the project status
3. Your response must be a JSON object in one of these formats:

IF ACTION IS NEEDED:
\`\`\`json
{
  "decision": "ACTION_NEEDED",
  "reason": "Explanation for your decision",
  "action_type": "message" | "data_update" | "request_for_data_update",
  "message_text": "The message you want to send", (only if action type is message)
  "action_payload": {
    // Additional data needed for the action, including the message and reason if action type is message
  }
}
\`\`\`

IF NO IMMEDIATE ACTION BUT FUTURE CHECK NEEDED:
\`\`\`json
{
  "decision": "SET_FUTURE_REMINDER",
  "action_type": "set_future_reminder",
  "days_until_check": 7, // Number of days until the next check (adjust as needed)
  "check_reason": "Detailed reason why a future check is needed",
  "action_payload": {
    "description": "Set reminder to check in X days: reason"
  }
}
\`\`\`

IF NO ACTION IS NEEDED:
\`\`\`json
{
  "decision": "NO_ACTION",
  "reason": "Explanation why no action is needed"
}
\`\`\`

REMINDER GUIDELINES:
- If you're evaluating time-sensitive milestones (e.g., site visits, permit applications), always consider setting a future reminder.
- Common scenarios for reminders include:
  * Checking if a site visit was scheduled within 3 days of contract signing
  * Following up on permit applications after 7-10 days
  * Checking on contractor selection within 5 days of receiving multiple quotes
  * Verifying project start date is confirmed 7 days before scheduled start
- When setting a reminder, be specific about the exact expectation you're checking for
- The system will automatically execute your decision. If you choose SET_FUTURE_REMINDER, the project's next_check_date will be updated.
- If this is already a reminder check (is_reminder_check is true), evaluate if the expected action occurred or if further action is now needed.`;
    } else if (promptType === 'multi_project_analysis') {
      return `You are an AI assistant tasked with analyzing communications that may reference multiple projects. Your job is to identify which projects are mentioned and extract the relevant information for each project.

Communication Type: {{communication_type}}
Communication Content: {{communication_content}}
Communication Participants: {{communication_participants}}
Current Date: {{current_date}}

Projects to Analyze Against:
{{projects_data}}

Instructions:
1. Carefully review the communication content
2. Identify any projects that are specifically mentioned or clearly referenced
3. For each relevant project, extract ONLY the information that pertains to that specific project
4. Ignore general chatter or information that doesn't relate to any specific project
5. Be precise in your extraction - do not include information about one project in another project's data

Your response must be a valid JSON object with the following structure:
\`\`\`json
{
  "projects": [
    {
      "projectId": "project-id-1",
      "relevantContent": "All information from the communication relevant to this specific project, formatted as a clear summary"
    },
    {
      "projectId": "project-id-2",
      "relevantContent": "All information from the communication relevant to this specific project, formatted as a clear summary"
    }
  ],
  "unreferencedProjects": ["project-id-3", "project-id-4"],
  "generalNotes": "Any general information that might be relevant but doesn't belong to a specific project"
}
\`\`\`

If no projects are referenced in the communication, return:
\`\`\`json
{
  "projects": [],
  "unreferencedProjects": ["project-id-1", "project-id-2", "project-id-3", "project-id-4"],
  "generalNotes": "Summary of the communication that doesn't reference any specific projects"
}
\`\`\`

Remember:
- Each project should only receive information specifically relevant to it
- Be thorough but concise in your extraction
- The system will use your response to update each project separately`;
    }
    return null;
  };

  const template = getSuggestedPromptTemplate();

  if (!template || (promptType !== 'summary_update' && promptType !== 'action_detection_execution' && promptType !== 'multi_project_analysis')) {
    return null;
  }

  return (
    <Button 
      variant="outline" 
      onClick={() => onApplyTemplate(template)}
      className="mb-2"
    >
      Use Suggested Template
    </Button>
  );
};

export default PromptTemplateHelper;
