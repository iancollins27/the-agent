
import React, { useState } from 'react';
import { Loader2 } from "lucide-react";
import ActionDetailModal from './ActionDetailModal';
import { ActionRecord } from "@/components/Chat/types";
import { useActionData } from './actions/useActionData';
import ActionCard from './actions/ActionCard';

interface PromptRunActionsProps {
  promptRunId: string | null;
}

const PromptRunActions: React.FC<PromptRunActionsProps> = ({ promptRunId }) => {
  const { actions, loading, fetchActions, updateActionStatus } = useActionData(promptRunId);
  const [selectedAction, setSelectedAction] = useState<ActionRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
        <ActionCard 
          key={action.id} 
          action={action} 
          onOpenDetails={openActionDetails}
          onActionUpdate={handleActionUpdated}
          updateActionStatus={updateActionStatus}
        />
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
