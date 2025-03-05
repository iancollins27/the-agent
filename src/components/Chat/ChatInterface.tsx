
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import ChatMessage from "./ChatMessage";
import { AlertCircle } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type ActionRecord = {
  id: string;
  action_type: string;
  action_payload: {
    field: string;
    value: string;
    description: string;
  };
  status: string;
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
  const [pendingAction, setPendingAction] = useState<ActionRecord | null>(null);
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

      // Check if an action record was created
      if (data.actionRecordId) {
        console.log('Action record created:', data.actionRecordId);
        
        // Fetch action record details
        const { data: actionRecord, error: actionError } = await supabase
          .from('action_records')
          .select('*')
          .eq('id', data.actionRecordId)
          .single();
          
        if (actionError) {
          console.error('Error fetching action record:', actionError);
        } else if (actionRecord) {
          console.log('Fetched action record:', actionRecord);
          setPendingAction(actionRecord as ActionRecord);
        }
      }
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

  const handleActionResponse = async (approve: boolean) => {
    if (!pendingAction) return;
    
    try {
      const { error } = await supabase
        .from('action_records')
        .update({
          status: approve ? 'approved' : 'rejected',
          executed_at: approve ? new Date().toISOString() : null
        })
        .eq('id', pendingAction.id);
        
      if (error) {
        throw error;
      }

      // If approved and it's a data update, update the project data
      if (approve && pendingAction.action_type === 'data_update' && projectId) {
        const updateData = {
          [pendingAction.action_payload.field]: pendingAction.action_payload.value
        };
        
        const { error: updateError } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId);
          
        if (updateError) {
          console.error('Error updating project:', updateError);
          toast({
            title: "Error",
            description: `Failed to update ${pendingAction.action_payload.field}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: pendingAction.action_payload.description || "Project updated successfully",
          });
        }
      } else if (!approve) {
        toast({
          title: "Action Rejected",
          description: "The proposed change was rejected",
        });
      }
      
      // Clear the pending action
      setPendingAction(null);
    } catch (error) {
      console.error('Error handling action response:', error);
      toast({
        title: "Error",
        description: "Failed to process your response",
        variant: "destructive",
      });
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
      
      {pendingAction && pendingAction.status === 'pending' && (
        <div className="bg-amber-50 border-y border-amber-200 p-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-800">Confirm Action</h4>
              <p className="text-sm text-amber-700 mt-1">
                {pendingAction.action_payload.description || 
                  `Update ${pendingAction.action_payload.field} to ${pendingAction.action_payload.value}`}
              </p>
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  onClick={() => handleActionResponse(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleActionResponse(false)}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
