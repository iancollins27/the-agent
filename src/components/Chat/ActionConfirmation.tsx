
import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle } from "lucide-react";
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

  return (
    <div className="bg-amber-50 border-y border-amber-200 p-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-800">Confirm Action</h4>
          <p className="text-sm text-amber-700 mt-1">
            {action.action_payload.description || 
              `Update ${action.action_payload.field} to ${action.action_payload.value}`}
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
  );
};

export default ActionConfirmation;
