
import React from 'react';
import { Badge } from "@/components/ui/badge";

interface ActionRecipientDisplayProps {
  action: {
    action_type: string;
    recipient_id?: string;
    action_payload?: {
      recipient?: string;
    };
  };
}

const ActionRecipientDisplay: React.FC<ActionRecipientDisplayProps> = ({ action }) => {
  // Get recipient from the action payload or use a default
  const recipient = action.action_payload?.recipient || "Project team";
  
  return (
    <Badge variant="outline" className="bg-slate-50">
      {recipient}
    </Badge>
  );
};

export default ActionRecipientDisplay;
