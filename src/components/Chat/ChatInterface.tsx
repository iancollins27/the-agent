
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import ActionConfirmation from "./ActionConfirmation";
import { ActionRecord } from "./types";

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
  const [placeholderId, setPlaceholderId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<ActionRecord[]>([]);
  const [currentAction, setCurrentAction] = useState<ActionRecord | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);

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

  useEffect(() => {
    // Fetch pending actions when project ID changes or on initial load
    if (projectId) {
      fetchPendingActions();
    }
  }, [projectId]);

  const fetchPendingActions = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('action_records')
        .select(`
          *,
          recipient:contacts!recipient_id(id, full_name),
          sender:contacts!sender_ID(id, full_name)
        `)
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .eq('requires_approval', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching pending actions:", error);
        return;
      }

      if (data && data.length > 0) {
        // Process the data to match ActionRecord type
        const processedData = data.map((record: any) => {
          const actionPayload = typeof record.action_payload === 'object' && record.action_payload !== null 
            ? record.action_payload 
            : {};
            
          return {
            ...record,
            recipient_name: record.recipient?.full_name || 
              (actionPayload && 'recipient' in actionPayload ? 
                actionPayload.recipient as string : null),
            sender_name: record.sender?.full_name || 
              (actionPayload && 'sender' in actionPayload ? 
                actionPayload.sender as string : null)
          };
        });
        
        setPendingActions(processedData as ActionRecord[]);
      }
    } catch (error) {
      console.error("Error fetching pending actions:", error);
    }
  };

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
      
      // Create a placeholder message for the AI response
      const aiPlaceholderId = uuidv4();
      const aiPlaceholder: ChatMessage = {
        id: aiPlaceholderId,
        role: 'assistant',
        content: "I'm thinking...",
        timestamp: new Date().toISOString(),
      };
      
      setMessages([...updatedMessages, aiPlaceholder]);
      setPlaceholderId(aiPlaceholderId);
      
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
            availableTools: chatbotConfig?.available_tools || ['identify_project', 'create_action_record']
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
      
      // Update the placeholder message with the final content
      setMessages(prev => prev.map(m => 
        m.id === aiPlaceholderId ? {
          ...m,
          content: displayContent,
          tool_calls: assistantMessage.tool_calls,
        } : m
      ));
      
      // Check if any tool call was the create_action_record tool
      const hasActionRecord = hasTool && assistantMessage.tool_calls.some(
        (call: any) => call.function.name === 'create_action_record'
      );
      
      // If an action was created, refresh the pending actions list
      if (hasActionRecord) {
        await fetchPendingActions();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to get a response. Please try again.',
      });
      
      // Remove the placeholder message if there was an error
      if (placeholderId) {
        setMessages(prev => prev.filter(m => m.id !== placeholderId));
        setPlaceholderId(null);
      }
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

  const handleActionClick = (action: ActionRecord) => {
    setCurrentAction(action);
    setIsActionDialogOpen(true);
  };

  const handleActionResolved = () => {
    // Remove the resolved action from the pending actions list
    setPendingActions(prev => prev.filter(a => a.id !== currentAction?.id));
    setCurrentAction(null);
    setIsActionDialogOpen(false);
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
        {isLoading && !placeholderId && (
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
        
        {pendingActions.length > 0 && (
          <div className="mb-4 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md">
            <div className="flex items-center gap-2 mb-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Pending Actions</span>
            </div>
            {pendingActions.slice(0, 3).map(action => (
              <div key={action.id} className="mb-2 last:mb-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between py-1 px-3 h-auto text-xs border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                  onClick={() => handleActionClick(action)}
                >
                  <span>
                    {action.action_type === 'message' ? 'Message to send' : 
                     action.action_type === 'data_update' ? 'Data update' :
                     action.action_type === 'set_future_reminder' ? 'Reminder to set' :
                     action.action_type.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs">Review</span>
                </Button>
              </div>
            ))}
            {pendingActions.length > 3 && (
              <div className="text-xs text-center text-amber-700 mt-1">
                +{pendingActions.length - 3} more actions need review
              </div>
            )}
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
      
      {/* Action confirmation dialog */}
      <ActionConfirmation
        action={currentAction}
        isOpen={isActionDialogOpen}
        onClose={() => setIsActionDialogOpen(false)}
        onActionResolved={handleActionResolved}
      />
    </div>
  );
};

export default ChatInterface;
