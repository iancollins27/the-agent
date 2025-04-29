
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

interface ActionRecipientDisplayProps {
  action: {
    action_type: string;
    recipient_id?: string | null;
    action_payload?: {
      recipient?: string;
      [key: string]: any;
    };
  };
}

const ActionRecipientDisplay: React.FC<ActionRecipientDisplayProps> = ({ action }) => {
  // Get recipient info from either the recipient_id or the payload
  const getRecipientInfo = () => {
    if (action.recipient_id) {
      return { id: action.recipient_id, display: "Contact" };
    }
    
    if (action.action_payload?.recipient) {
      return { id: null, display: action.action_payload.recipient };
    }
    
    return { id: null, display: "Project team" };
  };
  
  const recipientInfo = getRecipientInfo();
  
  return (
    <div className="flex items-center space-x-2">
      <MessageSquare className="h-4 w-4 text-muted-foreground" />
      <Badge variant="outline" className="text-xs">
        To: {recipientInfo.display}
      </Badge>
    </div>
  );
};

export default ActionRecipientDisplay;
