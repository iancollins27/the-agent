
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MessageAction from '../Chat/ActionConfirmation/MessageAction';

interface MessageActionConfirmationProps {
  action: {
    id: string;
    action_type: string;
    message?: string;
    action_payload?: {
      recipient?: string;
      message_content?: string;
      description?: string;
      [key: string]: any;
    };
    status: string;
  };
}

const MessageActionConfirmation: React.FC<MessageActionConfirmationProps> = ({ action }) => {
  // Extract message content and recipient from the action
  const messageContent = action.message || 
                         action.action_payload?.message_content ||
                         "No message content";
  
  const recipient = action.action_payload?.recipient || "Project team";
  const description = action.action_payload?.description;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-md">Message Action</CardTitle>
        <CardDescription>
          Status: <span className="font-medium">{action.status}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MessageAction 
          recipient={recipient}
          messageContent={messageContent}
          description={description}
        />
      </CardContent>
    </Card>
  );
};

export default MessageActionConfirmation;
