import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle, MapPin } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ActionRecord } from "./types";

type ActionConfirmationProps = {
  action: ActionRecord;
  onActionResolved: () => void;
};

const ActionConfirmation: React.FC<ActionConfirmationProps> = ({ action, onActionResolved }) => {
  const { toast } = useToast();

  const handleActionResponse = async (approve: boolean) => {
    try {
      const { error } = await supabase
        .from('action_records')
        .update({
          status: approve ? 'approved' : 'rejected',
          executed_at: approve ? new Date().toISOString() : null
        })
        .eq('id', action.id);
        
      if (error) {
        throw error;
      }

      // If approved and it's a data update, update the project data
      if (approve && action.action_type === 'data_update' && action.project_id) {
        const actionPayload = action.action_payload as Record<string, any>;
        const updateData = {
          [actionPayload.field]: actionPayload.value
        };
        
        const { error: updateError } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', action.project_id);
          
        if (updateError) {
          console.error('Error updating project:', updateError);
          toast({
            title: "Error",
            description: `Failed to update ${actionPayload.field}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: actionPayload.description || "Project updated successfully",
          });
        }
      } 
      // If approved and it's a message, handle sending the message
      else if (approve && action.action_type === 'message') {
        const actionPayload = action.action_payload as Record<string, any>;
        
        // Prepare recipient data
        const recipient = {
          id: action.recipient_id,
          name: action.recipient_name || actionPayload.recipient,
          phone: actionPayload.recipient_phone || actionPayload.phone,
          email: actionPayload.recipient_email || actionPayload.email
        };

        // Determine communication channel based on available recipient data
        let channel: 'sms' | 'email' | 'call' = 'sms'; // Default to SMS
        if (actionPayload.channel) {
          channel = actionPayload.channel as 'sms' | 'email' | 'call';
        } else if (recipient.email && !recipient.phone) {
          channel = 'email';
        }

        // Get message content from appropriate field
        const messageContent = action.message || 
                              actionPayload.message_content || 
                              actionPayload.content || 
                              '';
                              
        // Extract sender information
        const senderId = action.sender_ID || 
                        actionPayload.sender_id || 
                        actionPayload.senderId;
                        
        // Prepare sender data if available
        let sender = undefined;
        if (action.sender) {
          sender = {
            id: action.sender.id,
            name: action.sender.full_name,
            phone: action.sender.phone_number,
            email: action.sender.email
          };
        } else if (senderId) {
          // Fetch sender data if ID is available
          const { data: senderData, error: senderError } = await supabase
            .from('contacts')
            .select('id, full_name, phone_number, email')
            .eq('id', senderId)
            .maybeSingle();
            
          if (!senderError && senderData) {
            sender = {
              id: senderData.id,
              name: senderData.full_name,
              phone: senderData.phone_number,
              email: senderData.email
            };
          }
        }

        toast({
          title: "Sending Message",
          description: "Initiating communication...",
        });

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
            throw new Error(`Communication error: ${error.message}`);
          }
          
          toast({
            title: "Message Sent",
            description: `Communication successfully initiated`,
          });
          
        } catch (commError: any) {
          console.error('Error sending communication:', commError);
          toast({
            title: "Communication Failed",
            description: commError.message || "Failed to send the message",
            variant: "destructive",
          });
        }
      } else if (!approve) {
        toast({
          title: "Action Rejected",
          description: "The proposed change was rejected",
        });
      }
      
      // Notify parent component that action has been handled
      onActionResolved();
    } catch (error) {
      console.error('Error handling action response:', error);
      toast({
        title: "Error",
        description: "Failed to process your response",
        variant: "destructive",
      });
    }
  };

  const renderSenderRecipient = () => {
    if (action.sender_name && action.recipient_name) {
      return `From ${action.sender_name} to ${action.recipient_name}`;
    } else if (action.sender_name) {
      return `From ${action.sender_name}`;
    } else if (action.recipient_name) {
      return `To ${action.recipient_name}`;
    }
    return '';
  };

  // Cast action_payload to a proper type for safe access
  const actionPayload = action.action_payload as Record<string, any>;

  // Check if this is an address update or if address is available from project
  const isAddressUpdate = action.action_type === 'data_update' && 
    (actionPayload.field === 'Address' || actionPayload.field === 'project_address');
    
  const addressToShow = isAddressUpdate ? 
    actionPayload.value : 
    (action.project_address || (actionPayload && 'address' in actionPayload ? actionPayload.address : null));

  return (
    <div className="bg-amber-50 border-y border-amber-200 p-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-800">Confirm Action</h4>
          <p className="text-sm text-amber-700 mt-1">
            {actionPayload.description || 
              `Update ${actionPayload.field || ''} to ${String(actionPayload.value || '')}`}
          </p>
          {addressToShow && (
            <div className="flex items-center mt-1 text-xs text-amber-700">
              <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
              <span className="truncate">{addressToShow}</span>
            </div>
          )}
          {renderSenderRecipient() && (
            <p className="text-xs text-amber-600 mt-1">
              {renderSenderRecipient()}
            </p>
          )}
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
  );
};

export default ActionConfirmation;
