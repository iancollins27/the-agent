
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tool_calls?: any[];
}

interface ChatInterfaceProps {
  projectId?: string;
  presetMessage?: string;
}

const ChatInterface = ({ projectId, presetMessage = '' }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(presetMessage || '');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (presetMessage) {
      setInput(presetMessage);
    }
  }, [presetMessage]);

  useEffect(() => {
    // Scroll to bottom on message change
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Create a new message for the user input
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString(),
      };
      
      // Update the messages array with the new user message
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      
      // Get project data if we have a project ID
      let projectData = null;
      if (projectId) {
        const { data: project } = await supabase
          .from('projects')
          .select('*, companies(*)')
          .eq('id', projectId)
          .single();
          
        projectData = project;
      }
      
      // Get chatbot configuration
      const { data: chatbotConfig } = await supabase
        .from('chatbot_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      // Format messages for the API call, ensuring content is always a string
      const messagesToSend = updatedMessages.map(({ role, content }) => ({ 
        role, 
        content: content || '' // Ensure content is never null
      }));
      
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      // Send the request to our agent-chat edge function
      const response = await fetch(
        'https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/agent-chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            messages: messagesToSend,
            projectId,
            projectData,
            customPrompt: chatbotConfig?.system_prompt,
            availableTools: chatbotConfig?.available_tools || []
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Process the AI response
      const assistantMessage = data.choices[0].message;
      const content = assistantMessage.content || ""; // Use empty string if content is null
      
      // Check for tool calls and add a note to the message if they're present
      const hasTool = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;
      const displayContent = hasTool && !content 
        ? "I'm looking up some information for you..."
        : content;
        
      // Create the AI message object
      const aiMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: displayContent,
        timestamp: new Date().toISOString(),
        tool_calls: assistantMessage.tool_calls,
      };
      
      // Add the AI message to the messages array
      setMessages([...updatedMessages, aiMessage]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to get a response. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={`mb-4 flex ${message.role === 'assistant' ? 'items-start' : 'items-end justify-end'}`}>
            {message.role === 'assistant' && (
              <Avatar className="mr-3 h-8 w-8">
                <AvatarImage src="/icons/workflow-logo.png" alt="AI Assistant" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
            )}
            <div className={`rounded-lg p-3 text-sm w-fit max-w-[80%] ${message.role === 'assistant' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100' : 'bg-primary text-primary-foreground'}`}>
              {message.content}
            </div>
            {message.role === 'user' && (
              <Avatar className="ml-3 h-8 w-8">
                <AvatarImage src="https://github.com/shadcn.png" alt="User Avatar" />
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="mb-4 flex items-start">
            <Avatar className="mr-3 h-8 w-8">
              <AvatarImage src="/icons/workflow-logo.png" alt="AI Assistant" />
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <div className="rounded-lg p-3 text-sm w-fit max-w-[80%] bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={() => {
            sendMessage(input);
            setInput('');
          }} disabled={isLoading}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
