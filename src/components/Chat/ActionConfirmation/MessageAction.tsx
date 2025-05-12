
import React from 'react';
import { MessageCircle } from "lucide-react";

interface MessageActionProps {
  recipient: string;
  messageContent: string;
  description?: string;
}

const MessageAction: React.FC<MessageActionProps> = ({ recipient, messageContent, description }) => {
  return (
    <div className="space-y-2">
      {description && (
        <p className="text-sm p-3 bg-muted rounded-md">{description}</p>
      )}
      <div className="text-sm">
        <div className="font-medium mb-1">To: {recipient}</div>
      </div>
      <div className="flex flex-col gap-2 p-3 bg-blue-50 rounded-md">
        <div className="flex items-center gap-2 text-blue-700">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Message Content</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{messageContent}</p>
      </div>
    </div>
  );
};

export default MessageAction;
