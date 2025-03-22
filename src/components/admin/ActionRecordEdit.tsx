
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
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

  // Safely convert actionPayload fields to strings for display purposes
  const getActionFieldString = (field: any): string => {
    if (field === null || field === undefined) {
      return '';
    }
    return String(field);
  };

  // Parse action_payload for data_update actions
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

      // If approved and it's a data update, update the project data
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

          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActionRecordEdit;
