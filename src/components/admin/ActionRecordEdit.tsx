
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, XCircle, SendHorizonal } from "lucide-react";
import ActionTypeBadge from "./ActionTypeBadge";
import { ActionRecord } from "@/components/Chat/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ActionRecordEditProps {
  action: ActionRecord;
  onActionUpdated: () => void;
}

const ActionRecordEdit: React.FC<ActionRecordEditProps> = ({ action, onActionUpdated }) => {
  const [status, setStatus] = React.useState(action.status);
  const [message, setMessage] = React.useState(action.message || '');
  const [isSending, setIsSending] = React.useState(false);

  const getActionFieldString = (field: any): string => {
    if (field === null || field === undefined) {
      return '';
    }
    return String(field);
  };

  const actionPayload = action.action_payload as Record<string, any>;
  const field = actionPayload?.field ? getActionFieldString(actionPayload.field) : '';
  const value = actionPayload?.value ? getActionFieldString(actionPayload.value) : '';
  const description = actionPayload?.description ? getActionFieldString(actionPayload.description) : '';

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('action_records')
        .update({
          status,
          message,
          executed_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', action.id);

      if (error) throw error;

      if (status === 'approved' && action.action_type === 'data_update' && action.project_id) {
        const updateData: Record<string, any> = {
          [field]: actionPayload.value
        };
        
        const { error: updateError } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', action.project_id);
          
        if (updateError) {
          console.error('Error updating project:', updateError);
          toast.error(`Failed to update ${field}`);
        } else {
          toast.success(description || "Project updated successfully");
        }
      }

      toast.success("Action record updated successfully");
      onActionUpdated();
    } catch (error) {
      console.error('Error updating action record:', error);
      toast.error("Failed to update action record");
    }
  };

  const handleSendCommunication = async () => {
    if (action.action_type !== 'message') {
      toast.error("Only message actions can be sent as communications");
      return;
    }

    setIsSending(true);
    try {
      const actionPayload = action.action_payload as Record<string, any>;
      
      // Log sender_ID to debug
      console.log('DEBUG: action.sender_ID =', action.sender_ID);
      console.log('DEBUG: actionPayload.sender_id =', actionPayload.sender_id);
      console.log('DEBUG: actionPayload.senderId =', actionPayload.senderId);
      
      const senderId = action.sender_ID || 
                      actionPayload.sender_id || 
                      actionPayload.senderId;
      
      console.log('DEBUG: Final sender ID for communication:', senderId);
      
      // Prepare recipient details
      const recipient = {
        id: action.recipient_id,
        name: action.recipient_name,
        phone: actionPayload.recipient_phone || actionPayload.phone,
        email: actionPayload.recipient_email || actionPayload.email
      };

      console.log('DEBUG: Recipient info:', recipient);

      let channel: 'sms' | 'email' | 'call' = 'sms';
      if (actionPayload.channel) {
        channel = actionPayload.channel as 'sms' | 'email' | 'call';
      } else if (recipient.email && !recipient.phone) {
        channel = 'email';
      }

      const messageContent = action.message || 
                            actionPayload.message_content || 
                            actionPayload.content || 
                            '';

      toast.info("Initiating communication...");

      // Fetch sender contact details if we have a sender ID
      let sender = undefined;
      if (senderId) {
        console.log('DEBUG: Fetching contact details for sender ID:', senderId);
        
        const { data: senderData, error: senderError } = await supabase
          .from('contacts')
          .select('id, full_name, phone_number, email')
          .eq('id', senderId)
          .maybeSingle();
          
        if (senderError) {
          console.error('Error fetching sender:', senderError);
        } else if (senderData) {
          console.log('DEBUG: Sender data retrieved successfully:', senderData);
          console.log('DEBUG: Sender phone_number:', senderData.phone_number);
          console.log('DEBUG: Sender email:', senderData.email);
          console.log('DEBUG: Sender full_name:', senderData.full_name);
          
          sender = {
            id: senderData.id,
            name: senderData.full_name,
            phone: senderData.phone_number,
            email: senderData.email
          };
          
          console.log('DEBUG: Constructed sender object:', sender);
        } else {
          console.log('DEBUG: No sender data found for ID:', senderId);
        }
      } else {
        console.log('DEBUG: No sender ID provided, communication will be sent without sender info');
      }

      console.log('DEBUG: Final payload for send-communication:', {
        actionId: action.id,
        messageContent,
        recipient,
        sender,
        channel,
        projectId: action.project_id
      });

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
        console.error('DEBUG: Error from send-communication function:', error);
        throw error;
      }
      
      console.log('DEBUG: Communication sent successfully, response:', data);
      
      await supabase
        .from('action_records')
        .update({
          status: 'approved',
          executed_at: new Date().toISOString()
        })
        .eq('id', action.id);
      
      toast.success("Communication sent successfully");
      onActionUpdated();
    } catch (error) {
      console.error('Error sending communication:', error);
      toast.error("Failed to send communication");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <ActionTypeBadge type={action.action_type} />
            <span className="text-sm text-gray-500">{new Date(action.created_at).toLocaleString()}</span>
          </div>

          {action.action_type === 'data_update' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Field</Label>
                  <Input value={field} readOnly />
                </div>
                <div>
                  <Label>Value</Label>
                  <Input value={value} readOnly />
                </div>
              </div>
              {description && (
                <div>
                  <Label>Description</Label>
                  <Input value={description} readOnly />
                </div>
              )}
            </div>
          )}

          {action.action_type === 'message' && actionPayload?.content && (
            <div>
              <Label>Message</Label>
              <div className="border p-3 rounded-md bg-gray-50">
                {String(actionPayload.content)}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                    <span>Pending</span>
                  </div>
                </SelectItem>
                <SelectItem value="approved">
                  <div className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    <span>Approved</span>
                  </div>
                </SelectItem>
                <SelectItem value="rejected">
                  <div className="flex items-center">
                    <XCircle className="h-4 w-4 mr-2 text-red-500" />
                    <span>Rejected</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Admin Notes</Label>
            <Textarea
              value={message || ''}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add any notes about this action"
              className="min-h-[100px]"
            />
          </div>

          <div className="flex gap-2">
            {action.action_type === 'message' && (
              <Button 
                onClick={handleSendCommunication} 
                className="bg-blue-600 hover:bg-blue-700 flex-1"
                disabled={isSending}
              >
                <SendHorizonal className="h-4 w-4 mr-2" />
                {isSending ? "Sending..." : "Send Communication"}
              </Button>
            )}
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActionRecordEdit;
