
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Edit } from "lucide-react";
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
        .select('*')
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
      const { error } = await supabase
        .from('action_records')
        .update({
          status: 'approved',
          executed_at: new Date().toISOString()
        })
        .eq('id', actionId);

      if (error) throw error;
      
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
                
                {action.action_payload && (
                  <div className="text-sm mt-1">
                    {action.action_type === 'message' && (
                      <div className="line-clamp-2">
                        {(action.action_payload as any).message_content || 
                         (action.action_payload as any).content || 
                         action.message || 
                         "No message content"}
                      </div>
                    )}
                    {action.action_type === 'data_update' && (
                      <div>
                        Update <span className="font-medium">{(action.action_payload as any).field}</span> to{' '}
                        <span className="font-medium">{(action.action_payload as any).value}</span>
                      </div>
                    )}
                  </div>
                )}
                
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
