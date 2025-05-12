
import React from 'react';

interface ReminderActionProps {
  daysUntilCheck: number;
  checkReason: string;
  description?: string;
}

const ReminderAction: React.FC<ReminderActionProps> = ({ daysUntilCheck, checkReason, description }) => {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs text-muted-foreground">Follow up in</div>
        <div className="font-medium">{daysUntilCheck} days</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Reason</div>
        <div className="bg-muted p-2 rounded-md text-sm">{checkReason}</div>
      </div>
      {description && (
        <div>
          <div className="text-xs text-muted-foreground">Description</div>
          <div>{description}</div>
        </div>
      )}
    </div>
  );
};

export default ReminderAction;
