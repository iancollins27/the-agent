
import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, Mail, Database, Calendar, MapPin } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ActionRecord } from "./types";

type ActionConfirmDialogProps = {
  action: ActionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onActionResolved: () => void;
};

const ActionConfirmDialog: React.FC<ActionConfirmDialogProps> = ({ 
  action, 
  isOpen, 
  onClose,
  onActionResolved 
}) => {
  const { toast } = useToast();

  if (!action) return null;

  // Cast action_payload to a proper type for safe access
  const actionPayload = action.action_payload as Record<string, any>;

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
      // If approved and it's a SET_FUTURE_REMINDER action
      else if (approve && action.action_type === 'set_future_reminder' && action.project_id) {
        // Calculate the next check date based on days_until_check
        const daysToAdd = actionPayload.days_until_check || 7; // Default to 7 days if not specified
        const nextCheckDate = new Date();
        nextCheckDate.setDate(nextCheckDate.getDate() + daysToAdd);
        
        // Update the project with the next check date
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            next_check_date: nextCheckDate.toISOString()
          })
          .eq('id', action.project_id);
          
        if (updateError) {
          console.error('Error setting next check date:', updateError);
          toast({
            title: "Error",
            description: "Failed to set the reminder",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Reminder Set",
            description: `Reminder set to check this project again in ${daysToAdd} days`,
          });
          
          // Record the execution result
          const { error: executionError } = await supabase
            .from('action_records')
            .update({
              execution_result: {
                status: 'reminder_set',
                timestamp: new Date().toISOString(),
                next_check_date: nextCheckDate.toISOString(),
                details: `Reminder set to check in ${daysToAdd} days: ${actionPayload.check_reason || 'No reason provided'}`
              }
            })
            .eq('id', action.id);
            
          if (executionError) {
            console.error('Error recording execution result:', executionError);
          }
        }
      }
      // If approved and it's a message, handle the message sending action
      else if (approve && action.action_type === 'message') {
        // Call the edge function to send the communication
        toast({
          title: "Sending Message",
          description: "Initiating communication...",
        });
        
        // Prepare recipient data
        const recipient = {
          id: action.recipient_id,
          name: action.recipient_name,
          // Extract phone and email from action payload if available
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

        try {
          const { data, error } = await supabase.functions.invoke('send-communication', {
            body: {
              actionId: action.id,
              messageContent,
              recipient,
              channel,
              projectId: action.project_id,
              // If we have company ID (perhaps via project), send it to determine provider
              companyId: actionPayload.company_id
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
          
          // Record the execution failure
          const { error: executionError } = await supabase
            .from('action_records')
            .update({
              execution_result: {
                status: 'communication_failed',
                timestamp: new Date().toISOString(),
                error: commError.message
              }
            })
            .eq('id', action.id);
            
          if (executionError) {
            console.error('Error recording execution result:', executionError);
          }
        }
      }
      // If approved and it's a notion integration
      else if (approve && action.action_type === 'notion_integration') {
        // Call the edge function to process the notion integration
        const { data, error: notionError } = await supabase.functions.invoke('process-notion-integration', {
          body: { 
            companyId: action.project_id ? 
              (await supabase.from('projects').select('company_id').eq('id', action.project_id).single()).data?.company_id : 
              null,
            notionToken: actionPayload.notion_token,
            notionDatabaseId: actionPayload.notion_database_id,
            notionPageId: actionPayload.notion_page_id
          }
        });
        
        if (notionError) {
          console.error('Error processing Notion integration:', notionError);
          toast({
            title: "Error",
            description: "Failed to process Notion integration",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Notion integration started. Content will be processed in the background.",
          });
          
          // Record the execution result
          const { error: executionError } = await supabase
            .from('action_records')
            .update({
              execution_result: {
                status: 'notion_integration_started',
                timestamp: new Date().toISOString(),
                details: data
              }
            })
            .eq('id', action.id);
            
          if (executionError) {
            console.error('Error recording execution result:', executionError);
          }
        }
      } else if (!approve) {
        toast({
          title: "Action Rejected",
          description: "The proposed action was rejected",
        });
      }
      
      // Notify parent component that action has been handled
      onClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Confirm Action
          </DialogTitle>
          <DialogDescription>
            Please review and confirm the requested action.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <h4 className="font-medium mb-2">Action Details:</h4>
          <p className="text-sm text-muted-foreground mb-1">
            <span className="font-medium">Type:</span> {action.action_type.replace(/_/g, ' ')}
          </p>
          
          {action.action_type === 'data_update' && (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Field:</span> {actionPayload.field}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">New Value:</span> {actionPayload.value}
              </p>
              {actionPayload.field === 'Address' && (
                <div className="flex items-start mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{actionPayload.value}</span>
                </div>
              )}
            </>
          )}
          
          {action.action_type === 'set_future_reminder' && (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Check in:</span> {actionPayload.days_until_check} days
              </p>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Reason:</p>
                <p className="text-sm">{actionPayload.check_reason}</p>
              </div>
            </>
          )}
          
          {action.action_type === 'message' && (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Recipient:</span> {action.recipient?.full_name || actionPayload.recipient || 'No recipient specified'}
              </p>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Message Content:</p>
                <p className="text-sm">{action.message || actionPayload.message_content}</p>
              </div>
            </>
          )}
          
          {action.action_type === 'notion_integration' && (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Integration Type:</span> Notion
              </p>
              {actionPayload.notion_database_id && (
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium">Database ID:</span> {actionPayload.notion_database_id}
                </p>
              )}
              {actionPayload.notion_page_id && (
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium">Page ID:</span> {actionPayload.notion_page_id}
                </p>
              )}
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Note:</p>
                <p className="text-sm">
                  This will integrate with Notion and create vector embeddings for search functionality. 
                  The API token will be securely stored.
                </p>
              </div>
            </>
          )}
          
          <p className="text-sm mt-2 p-3 bg-muted rounded-md">
            {actionPayload.description}
          </p>
        </div>
        
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => handleActionResponse(false)}>
            Reject
          </Button>
          <Button onClick={() => handleActionResponse(true)}>
            <Check className="h-4 w-4 mr-2" /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActionConfirmDialog;
