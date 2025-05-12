
import React from 'react';

interface MessageActionProps {
  recipient: string;
  messageContent: string;
  description?: string;
}

const MessageAction: React.FC<MessageActionProps> = ({ recipient, messageContent, description }) => {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs text-muted-foreground">To</div>
        <div className="font-medium">{recipient}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Message</div>
        <div className="bg-muted p-2 rounded-md text-sm whitespace-pre-wrap">{messageContent}</div>
      </div>
      {description && (
        <div>
          <div className="text-xs text-muted-foreground">Description</div>
          <div>{description}</div>
        </div>
      )}
    </div>
  );
};

export default MessageAction;
