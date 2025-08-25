
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Edit, MessageCircle, User } from "lucide-react";
import { ActionRecord } from "@/components/Chat/types";
import ActionTypeBadge from "./ActionTypeBadge";
import { toast } from "sonner";
import ActionDetailModal from './ActionDetailModal';

interface PromptRunActionsProps {
  promptRunId: string | null;
}

const PromptRunActions: React.FC<PromptRunActionsProps> = ({ promptRunId }) => {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (promptRunId) {
      fetchActions();
    } else {
      setActions([]);
    }
  }, [promptRunId]);

  const fetchActions = async () => {
    if (!promptRunId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('action_records')
        .select(`
          *,
          recipient:contacts!recipient_id(id, full_name, phone_number, email),
          sender:contacts!sender_ID(id, full_name, phone_number, email)
        `)
        .eq('prompt_run_id', promptRunId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
      toast.error("Failed to load actions");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAction = async (actionId: string) => {
    try {
      const action = actions.find(a => a.id === actionId);
      if (!action) {
        throw new Error("Action not found");
      }

      // First update the action status
      const { error } = await supabase
        .from('action_records')
        .update({
          status: 'approved',
          executed_at: new Date().toISOString()
        })
        .eq('id', actionId);

      if (error) throw error;
      
      // If it's a message action, also send the communication
      if (action.action_type === 'message') {
        const actionPayload = action.action_payload as Record<string, any>;
        
        // Prepare recipient data
        const recipient = {
          id: action.recipient_id,
          name: action.recipient_name || (actionPayload && typeof actionPayload === 'object' ? actionPayload.recipient : null),
          phone: action.recipient?.phone_number || 
                (actionPayload && typeof actionPayload === 'object' ? actionPayload.recipient_phone || actionPayload.phone : null),
          email: action.recipient?.email || 
                (actionPayload && typeof actionPayload === 'object' ? actionPayload.recipient_email || actionPayload.email : null)
        };

        // Prepare sender data
        const sender = {
          id: action.sender_ID,
          name: action.sender_name || (actionPayload && typeof actionPayload === 'object' ? actionPayload.sender_name : null),
          phone: action.sender?.phone_number || 
                (actionPayload && typeof actionPayload === 'object' ? actionPayload.sender_phone || actionPayload.from : null),
          email: action.sender?.email || 
                (actionPayload && typeof actionPayload === 'object' ? actionPayload.sender_email : null)
        };

        // Determine communication channel based on available recipient data
        let channel: 'sms' | 'email' | 'call' = 'sms'; // Default to SMS
        if (actionPayload && typeof actionPayload === 'object' && actionPayload.channel) {
          channel = actionPayload.channel as 'sms' | 'email' | 'call';
        } else if (recipient.email && !recipient.phone) {
          channel = 'email';
        }

        // Get message content from appropriate field
        const messageContent = action.message || 
                              (actionPayload && typeof actionPayload === 'object' ? actionPayload.message_content || actionPayload.content : '') ||
                              '';

        toast.info("Sending communication...");
        
        try {
          const { data, error } = await supabase.functions.invoke('send-communication', {
            body: {
              actionId: action.id,
              messageContent,
              recipient,
              sender,
              channel,
              projectId: action.project_id
            }
          });
          
          if (error) {
            throw error;
          }
          
          toast.success("Communication sent successfully");
        } catch (commError) {
          console.error('Error sending communication:', commError);
          toast.error("Failed to send communication");
        }
      }
      
      // Update local state to reflect change
      setActions(prev => 
        prev.map(action => 
          action.id === actionId ? { ...action, status: 'approved', executed_at: new Date().toISOString() } : action
        )
      );
      
      toast.success("Action approved successfully");
    } catch (error) {
      console.error('Error approving action:', error);
      toast.error("Failed to approve action");
    }
  };

  const handleRejectAction = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from('action_records')
        .update({
          status: 'rejected'
        })
        .eq('id', actionId);

      if (error) throw error;
      
      // Update local state to reflect change
      setActions(prev => 
        prev.map(action => 
          action.id === actionId ? { ...action, status: 'rejected' } : action
        )
      );
      
      toast.success("Action rejected successfully");
    } catch (error) {
      console.error('Error rejecting action:', error);
      toast.error("Failed to reject action");
    }
  };

  const openActionDetails = (action: ActionRecord) => {
    setSelectedAction(action);
    setDetailsOpen(true);
  };

  const handleActionUpdated = () => {
    fetchActions();
  };

  const renderCommunicationParties = (action: ActionRecord) => {
    // Only show for message type actions
    if (action.action_type !== 'message') return null;
    
    const senderName = action.sender?.full_name || action.sender_name || "Unknown sender";
    const recipientName = action.recipient?.full_name || action.recipient_name || "Unknown recipient";
    
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
        <User className="h-3 w-3" />
        <span>From: <span className="font-medium">{senderName}</span></span>
        <span className="mx-1">→</span>
        <span>To: <span className="font-medium">{recipientName}</span></span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No actions found for this prompt run
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-base">Associated Actions</h3>
      
      {actions.map((action) => (
        <Card key={action.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ActionTypeBadge type={action.action_type} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(action.created_at).toLocaleString()}
                  </span>
                </div>
                
                {action.action_type === 'message' && (
                  <div className="flex items-start gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                    <div className="line-clamp-2 text-sm">
                      {action.message || 
                      (typeof action.action_payload === 'object' && action.action_payload !== null ? 
                        (action.action_payload as any).message_content || 
                        (action.action_payload as any).content || 
                        "No message content" 
                      : "No message content")}
                    </div>
                  </div>
                )}
                
                {action.action_type === 'data_update' && (
                  <div className="text-sm">
                    Update <span className="font-medium">
                      {typeof action.action_payload === 'object' && action.action_payload !== null ? 
                        (action.action_payload as any).field : 'unknown field'}
                    </span> to{' '}
                    <span className="font-medium">
                      {typeof action.action_payload === 'object' && action.action_payload !== null ? 
                        (action.action_payload as any).value : 'unknown value'}
                    </span>
                  </div>
                )}
                
                {(action.action_type.includes('reminder') || action.action_type === 'set_future_reminder') && (
                  <div className="text-sm">
                    <div className="font-medium mb-1">
                      {typeof action.action_payload === 'object' && action.action_payload !== null ? 
                        (action.action_payload as any).check_reason || 
                        (action.action_payload as any).reason ||
                        'Follow-up reminder' : 'Follow-up reminder'}
                    </div>
                    
                    {/* Reminder description */}
                    {typeof action.action_payload === 'object' && action.action_payload !== null && (
                      (action.action_payload as any).description || 
                      (action.action_payload as any).reminder_description
                    ) && (
                      <div className="text-sm text-muted-foreground mb-2 p-2 bg-muted rounded">
                        {(action.action_payload as any).description || (action.action_payload as any).reminder_description}
                      </div>
                    )}
                  </div>
                )}
                
                {renderCommunicationParties(action)}
                
                <div className="text-xs font-medium">
                  Status: <span className={
                    action.status === 'approved' ? 'text-green-600' : 
                    action.status === 'rejected' ? 'text-red-600' : 
                    'text-amber-600'
                  }>
                    {action.status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => openActionDetails(action)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                
                {action.status === 'pending' && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleApproveAction(action.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRejectAction(action.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <ActionDetailModal 
        action={selectedAction}
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onActionUpdated={handleActionUpdated}
      />
    </div>
  );
};

export default PromptRunActions;
