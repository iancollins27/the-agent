
import React, { useRef, useEffect } from 'react';
import ChatMessage from "./ChatMessage";
import { Message } from "./types";

type MessageListProps = {
  messages: Message[];
};

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-0 h-full">
      <div className="flex flex-col p-4 space-y-4 min-h-full">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-center p-6">
            <p className="text-muted-foreground">
              Ask me about project details or workflow processes. I can also help update project data like:
            </p>
            <ul className="list-disc text-left space-y-2 text-muted-foreground">
              <li>Update installation dates</li>
              <li>Change project status</li>
              <li>Modify next steps</li>
              <li>Update project schedule</li>
            </ul>
            <p className="text-sm text-muted-foreground italic mt-4">
              Just tell me what you want to update and I'll help you make the change!
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
