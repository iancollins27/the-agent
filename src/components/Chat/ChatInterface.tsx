
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import ChatMessage from "./ChatMessage";

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatInterfaceProps = {
  projectId?: string;
  className?: string;
  presetMessage?: string;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ projectId, className, presetMessage }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle preset message if provided
  useEffect(() => {
    if (presetMessage && presetMessage.trim() !== '') {
      setInput(presetMessage);
    }
  }, [presetMessage]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const messageHistory = [...messages, userMessage].map(({ role, content }) => ({ role, content }));
      
      const { data, error } = await supabase.functions.invoke('agent-chat', {
        body: { messages: messageHistory, projectId }
      });

      if (error) {
        throw new Error(error.message);
      }

      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: data.reply }
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to get a response from the assistant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className={`flex flex-col h-[600px] ${className}`}>
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-lg">Project Assistant</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-0">
        <div className="flex flex-col p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground italic">
              Ask me about project details or workflow processes
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      
      <CardFooter className="p-4 border-t">
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
      </CardFooter>
    </Card>
  );
};

export default ChatInterface;
