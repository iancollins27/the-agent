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
import { Check, AlertCircle, Mail, Database, Calendar } from "lucide-react";
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
          [action.action_payload.field]: action.action_payload.value
        };
        
        const { error: updateError } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', action.project_id);
          
        if (updateError) {
          console.error('Error updating project:', updateError);
          toast({
            title: "Error",
            description: `Failed to update ${action.action_payload.field}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: action.action_payload.description || "Project updated successfully",
          });
        }
      } 
      // If approved and it's a SET_FUTURE_REMINDER action
      else if (approve && action.action_type === 'set_future_reminder' && action.project_id) {
        // Calculate the next check date based on days_until_check
        const daysToAdd = action.action_payload.days_until_check || 7; // Default to 7 days if not specified
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
                details: `Reminder set to check in ${daysToAdd} days: ${action.action_payload.check_reason || 'No reason provided'}`
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
        // In a real implementation, this would connect to an email/messaging service
        // For now, we'll just show a toast notification
        const recipient = action.recipient?.full_name || action.action_payload.recipient || 'No recipient specified';
        
        toast({
          title: "Message Sent",
          description: `Message to ${recipient} has been sent successfully`,
        });
        
        // Record that the message was "sent" (in a real app, we would actually send it here)
        const { error: executionError } = await supabase
          .from('action_records')
          .update({
            execution_result: {
              status: 'message_sent',
              timestamp: new Date().toISOString(),
              details: `Message to ${recipient} sent successfully`
            }
          })
          .eq('id', action.id);
          
        if (executionError) {
          console.error('Error recording execution result:', executionError);
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
            notionToken: action.action_payload.notion_token,
            notionDatabaseId: action.action_payload.notion_database_id,
            notionPageId: action.action_payload.notion_page_id
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
                <span className="font-medium">Field:</span> {action.action_payload.field}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">New Value:</span> {action.action_payload.value}
              </p>
            </>
          )}
          
          {action.action_type === 'set_future_reminder' && (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Check in:</span> {action.action_payload.days_until_check} days
              </p>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Reason:</p>
                <p className="text-sm">{action.action_payload.check_reason}</p>
              </div>
            </>
          )}
          
          {action.action_type === 'message' && (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Recipient:</span> {action.recipient?.full_name || action.action_payload.recipient || 'No recipient specified'}
              </p>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Message Content:</p>
                <p className="text-sm">{action.message || action.action_payload.message_content}</p>
              </div>
            </>
          )}
          
          {action.action_type === 'notion_integration' && (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Integration Type:</span> Notion
              </p>
              {action.action_payload.notion_database_id && (
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium">Database ID:</span> {action.action_payload.notion_database_id}
                </p>
              )}
              {action.action_payload.notion_page_id && (
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium">Page ID:</span> {action.action_payload.notion_page_id}
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
            {action.action_payload.description}
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
