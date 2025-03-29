
import React from 'react';

interface MessageActionProps {
  recipient: string;
  messageContent: string;
  description?: string;
}

const MessageAction: React.FC<MessageActionProps> = ({ recipient, messageContent, description }) => {
  return (
    <>
      <p className="text-sm text-muted-foreground mb-1">
        <span className="font-medium">Recipient:</span> {recipient || 'No recipient specified'}
      </p>
      <div className="mt-2 p-3 bg-muted rounded-md">
        <p className="text-sm font-medium mb-1">Message Content:</p>
        <p className="text-sm">{messageContent}</p>
      </div>
      {description && (
        <p className="text-sm mt-2 p-3 bg-muted rounded-md">
          {description}
        </p>
      )}
    </>
  );
};

export default MessageAction;
