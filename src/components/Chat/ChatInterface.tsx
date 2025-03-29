import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Message, ActionRecord } from "./types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ActionConfirmDialog from "./ActionConfirmation";

type ChatInterfaceProps = {
  projectId?: string;
  className?: string;
  presetMessage?: string;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ projectId, className, presetMessage }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionRecord | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async (input: string) => {
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
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
        
        // Fetch action record details with explicit specification of relationships
        const { data: actionRecordData, error: actionError } = await supabase
          .from('action_records')
          .select(`
            *,
            recipient:contacts!recipient_id(id, full_name),
            sender:contacts!sender_ID(id, full_name)
          `)
          .eq('id', data.actionRecordId)
          .single();
          
        if (actionError) {
          console.error('Error fetching action record:', actionError);
        } else if (actionRecordData) {
          console.log('Fetched action record:', actionRecordData);
          
          // Convert the database record to our ActionRecord type with proper type safety
          const payload = typeof actionRecordData.action_payload === 'object' 
            ? actionRecordData.action_payload as Record<string, any>
            : {};
            
          const actionRecord: ActionRecord = {
            id: actionRecordData.id,
            action_type: actionRecordData.action_type,
            message: actionRecordData.message,
            status: actionRecordData.status,
            requires_approval: actionRecordData.requires_approval,
            created_at: actionRecordData.created_at,
            executed_at: actionRecordData.executed_at,
            project_id: actionRecordData.project_id,
            recipient_id: actionRecordData.recipient_id,
            sender_ID: actionRecordData.sender_ID,
            approver_id: actionRecordData.approver_id,
            action_payload: {
              description: payload.description || '',
              field: payload.field || '',
              value: payload.value || '',
              recipient: payload.recipient || '',
              sender: payload.sender || '',
              message_content: payload.message_content || '',
              notion_token: payload.notion_token || '',
              notion_database_id: payload.notion_database_id || '',
              notion_page_id: payload.notion_page_id || '',
              days_until_check: payload.days_until_check || 0,
              check_reason: payload.check_reason || '',
              date: payload.date || ''
            },
            execution_result: actionRecordData.execution_result,
            recipient: actionRecordData.recipient,
            recipient_name: actionRecordData.recipient?.full_name || 
              (typeof payload === 'object' ? payload.recipient : ''),
            sender: actionRecordData.sender,
            sender_name: actionRecordData.sender?.full_name || 
              (typeof payload === 'object' ? payload.sender : '')
          };
          
          setPendingAction(actionRecord);
          setActionDialogOpen(true);
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

  const handleActionResolved = () => {
    setPendingAction(null);
  };

  return (
    <Card className={`flex flex-col h-[600px] ${className}`}>
      <CardHeader className="px-4 py-3 border-b shrink-0">
        <CardTitle className="text-lg">Project Assistant</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto">
          <MessageList messages={messages} />
        </div>
      </CardContent>
      
      <CardFooter className="p-4 border-t shrink-0">
        <MessageInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          presetMessage={presetMessage}
        />
      </CardFooter>

      <ActionConfirmDialog
        action={pendingAction}
        isOpen={actionDialogOpen}
        onClose={() => setActionDialogOpen(false)}
        onActionResolved={handleActionResolved}
      />
    </Card>
  );
};

export default ChatInterface;
