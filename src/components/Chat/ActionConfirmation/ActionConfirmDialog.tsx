
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
import { Check, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ActionConfirmationProps } from "./types";
import DataUpdateAction from "./DataUpdateAction";
import ReminderAction from "./ReminderAction";
import MessageAction from "./MessageAction";
import NotionAction from "./NotionAction";
import { executeAction, rejectAction } from "./actionService";

const ActionConfirmDialog: React.FC<ActionConfirmationProps> = ({ 
  action, 
  isOpen, 
  onClose,
  onActionResolved 
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);

  if (!action) return null;

  // Cast action_payload to a proper type for safe access
  const actionPayload = action.action_payload as Record<string, any>;

  const handleActionResponse = async (approve: boolean) => {
    try {
      setIsProcessing(true);
      
      if (approve) {
        console.log('Approving action:', action);
        await executeAction(action);
      } else {
        console.log('Rejecting action:', action.id);
        await rejectAction(action.id);
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
    } finally {
      setIsProcessing(false);
    }
  };

  // Render the appropriate action details based on action type
  const renderActionDetails = () => {
    switch (action.action_type) {
      case 'data_update':
        return (
          <DataUpdateAction 
            field={actionPayload.field || ''} 
            value={actionPayload.value || ''} 
            description={actionPayload.description || ''}
          />
        );
      
      case 'set_future_reminder':
        return (
          <ReminderAction 
            daysUntilCheck={actionPayload.days_until_check || 7} 
            checkReason={actionPayload.check_reason || ''} 
            description={actionPayload.description || ''}
          />
        );
      
      case 'message':
        return (
          <MessageAction 
            recipient={action.recipient?.full_name || actionPayload.recipient || ''} 
            messageContent={action.message || actionPayload.message_content || ''} 
            description={actionPayload.description}
          />
        );
      
      case 'notion_integration':
        // Return a deprecation notice for notion integration
        return (
          <NotionAction 
            description="Notion integration has been deprecated. This action cannot be processed."
          />
        );
      
      default:
        return (
          <p className="text-sm mt-2 p-3 bg-muted rounded-md">
            {actionPayload.description || 'No details available for this action type.'}
          </p>
        );
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
          
          {renderActionDetails()}
        </div>
        
        <DialogFooter className="sm:justify-between">
          <Button 
            variant="outline" 
            onClick={() => handleActionResponse(false)}
            disabled={isProcessing || action.action_type === 'notion_integration'}
          >
            Reject
          </Button>
          <Button 
            onClick={() => handleActionResponse(true)}
            disabled={isProcessing || action.action_type === 'notion_integration'}
          >
            <Check className="h-4 w-4 mr-2" /> 
            {isProcessing ? "Processing..." : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActionConfirmDialog;
