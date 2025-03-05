
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";

type MessageInputProps = {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  presetMessage?: string;
};

const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage, 
  isLoading, 
  presetMessage 
}) => {
  const [input, setInput] = useState(presetMessage || '');

  // Handle preset message if provided
  React.useEffect(() => {
    if (presetMessage && presetMessage.trim() !== '') {
      setInput(presetMessage);
    }
  }, [presetMessage]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex w-full items-center space-x-2">
      <Input
        placeholder="Type your message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="flex-1"
      />
      <Button 
        onClick={handleSend} 
        disabled={isLoading || !input.trim()}
        size="icon"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default MessageInput;
