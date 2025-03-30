
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Edit, MessageCircle, User } from "lucide-react";
import { ActionRecord } from "@/components/Chat/types";
import ActionTypeBadge from "../ActionTypeBadge";
import { handleApproveAction, handleRejectAction } from './actionOperations';

interface ActionCardProps {
  action: ActionRecord;
  onOpenDetails: (action: ActionRecord) => void;
  onActionUpdate: () => void;
  updateActionStatus: (actionId: string, status: string, executedAt?: string) => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ 
  action, 
  onOpenDetails, 
  onActionUpdate,
  updateActionStatus
}) => {
  
  const handleApprove = async () => {
    try {
      await handleApproveAction(action);
      updateActionStatus(action.id, 'approved', new Date().toISOString());
      onActionUpdate();
    } catch (error) {
      console.error('Error approving action:', error);
    }
  };

  const handleReject = async () => {
    try {
      await handleRejectAction(action.id);
      updateActionStatus(action.id, 'rejected');
      onActionUpdate();
    } catch (error) {
      console.error('Error rejecting action:', error);
    }
  };

  const renderCommunicationParties = () => {
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

  const renderActionContent = () => {
    const actionPayload = action.action_payload as Record<string, any>;
    
    if (action.action_type === 'message') {
      return (
        <div className="flex items-start gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
          <div className="line-clamp-2 text-sm">
            {action.message || 
            (typeof actionPayload === 'object' && actionPayload !== null ? 
              actionPayload.message_content || 
              actionPayload.content || 
              "No message content" 
            : "No message content")}
          </div>
        </div>
      );
    }
    
    if (action.action_type === 'data_update') {
      return (
        <div className="text-sm">
          Update <span className="font-medium">
            {typeof actionPayload === 'object' && actionPayload !== null ? 
              actionPayload.field : 'unknown field'}
          </span> to{' '}
          <span className="font-medium">
            {typeof actionPayload === 'object' && actionPayload !== null ? 
              actionPayload.value : 'unknown value'}
          </span>
        </div>
      );
    }
    
    return null;
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ActionTypeBadge type={action.action_type} />
              <span className="text-xs text-muted-foreground">
                {new Date(action.created_at).toLocaleString()}
              </span>
            </div>
            
            {renderActionContent()}
            {renderCommunicationParties()}
            
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
              onClick={() => onOpenDetails(action)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            {action.status === 'pending' && (
              <>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={handleApprove}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleReject}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActionCard;
