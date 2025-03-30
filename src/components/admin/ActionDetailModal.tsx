
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, Database, Calendar, MapPin, User, Phone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ActionRecord } from "@/components/Chat/types";
import ActionTypeBadge from "./ActionTypeBadge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface ActionDetailModalProps {
  action: ActionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onActionUpdated: () => void;
}

const ActionDetailModal: React.FC<ActionDetailModalProps> = ({
  action,
  isOpen,
  onClose,
  onActionUpdated
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [editedMessage, setEditedMessage] = useState<string>("");
  const [senderDetails, setSenderDetails] = useState<{ name?: string, phone?: string, email?: string } | null>(null);

  // Initialize form values and fetch sender details when action changes
  React.useEffect(() => {
    if (action) {
      const actionPayload = action.action_payload as Record<string, any>;
      // Set message based on action type
      if (action.action_type === 'message') {
        setEditedMessage(action.message || 
          actionPayload.message_content || 
          actionPayload.message_text || 
          ""
        );
        
        // Fetch sender details if sender_ID is available
        if (action.sender_ID) {
          fetchSenderDetails(action.sender_ID);
        } else {
          setSenderDetails(null);
        }
      } else if (actionPayload.description) {
        setEditedMessage(actionPayload.description);
      } else {
        setEditedMessage(action.message || "");
      }
    }
  }, [action]);

  // Fetch sender details from contacts table
  const fetchSenderDetails = async (senderId: string) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('full_name, phone_number, email')
        .eq('id', senderId)
        .single();
        
      if (error) {
        console.error('Error fetching sender details:', error);
        setSenderDetails(null);
      } else if (data) {
        setSenderDetails({
          name: data.full_name,
          phone: data.phone_number,
          email: data.email
        });
      }
    } catch (error) {
      console.error('Error in fetchSenderDetails:', error);
      setSenderDetails(null);
    }
  };

  if (!action) return null;

  const actionPayload = action.action_payload as Record<string, any>;

  const handleSave = async () => {
    if (!action) return;
    
    setIsLoading(true);
    try {
      // Prepare update data
      const updateData: Record<string, any> = {
        message: editedMessage
      };

      // Also update the action_payload if it's a message action
      if (action.action_type === 'message') {
        const updatedPayload = { ...actionPayload };
        if ('message_content' in updatedPayload) {
          updatedPayload.message_content = editedMessage;
        } else {
          updatedPayload.message_content = editedMessage;
        }
        updateData.action_payload = updatedPayload;
      } else if (action.action_type === 'data_update') {
        // For data updates, we might want to update the description
        const updatedPayload = { ...actionPayload };
        if ('description' in updatedPayload) {
          updatedPayload.description = editedMessage;
        }
        updateData.action_payload = updatedPayload;
      }

      // Update the record in the database
      const { error } = await supabase
        .from('action_records')
        .update(updateData)
        .eq('id', action.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Action message updated successfully",
      });

      onActionUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating action record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update action message",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    switch(action.action_type) {
      case 'message': return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'data_update': return <Database className="h-5 w-5 text-green-500" />;
      case 'set_future_reminder': return <Calendar className="h-5 w-5 text-amber-500" />;
      default: return null;
    }
  };

  const senderName = senderDetails?.name || action.sender?.full_name || action.sender_name || actionPayload.sender || null;
  const senderPhone = senderDetails?.phone || action.sender?.phone_number || actionPayload.sender_phone || null;
  const recipientName = action.recipient?.full_name || action.recipient_name || actionPayload.recipient || null;

  // Format phone number for display if it exists
  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return null;
    
    // Basic formatting for US numbers, can be expanded for international
    if (phone.length === 10) {
      return `(${phone.substring(0, 3)}) ${phone.substring(3, 6)}-${phone.substring(6)}`;
    }
    return phone;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            Edit Action Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <ActionTypeBadge type={action.action_type} />
            <span className="text-sm text-gray-500">
              {new Date(action.created_at || '').toLocaleString()}
            </span>
          </div>
          
          {/* Sender and Recipient Information */}
          {action.action_type === 'message' && (senderName || recipientName) && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                {senderName && (
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      From
                    </Label>
                    <div className="text-sm bg-muted p-2 rounded-md flex items-center justify-between">
                      <span>{senderName}</span>
                      {senderPhone && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2">
                            <p className="text-sm">{formatPhoneNumber(senderPhone)}</p>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                )}
                
                {recipientName && (
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      To
                    </Label>
                    <div className="text-sm bg-muted p-2 rounded-md">
                      {recipientName}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {action.action_type === 'data_update' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Field</Label>
                  <Input value={actionPayload.field || ''} readOnly />
                </div>
                <div>
                  <Label>Value</Label>
                  <Input value={actionPayload.value || ''} readOnly />
                </div>
              </div>
              
              {actionPayload.field === 'Address' && (
                <div className="flex items-start mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{actionPayload.value}</span>
                </div>
              )}
            </div>
          )}
          
          <div>
            <Label htmlFor="message">
              {action.action_type === 'message' ? 'Message Content' : 'Description'}
            </Label>
            <Textarea
              id="message"
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              placeholder="Enter message or description"
              className="min-h-[100px] mt-1"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActionDetailModal;
