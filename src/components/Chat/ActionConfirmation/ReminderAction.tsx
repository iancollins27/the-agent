
import React from 'react';

interface ReminderActionProps {
  daysUntilCheck: number;
  checkReason: string;
  description: string;
}

const ReminderAction: React.FC<ReminderActionProps> = ({ daysUntilCheck, checkReason, description }) => {
  return (
    <>
      <p className="text-sm text-muted-foreground mb-1">
        <span className="font-medium">Check in:</span> {daysUntilCheck} days
      </p>
      <div className="mt-2 p-3 bg-muted rounded-md">
        <p className="text-sm font-medium mb-1">Reason:</p>
        <p className="text-sm">{checkReason}</p>
      </div>
      {description && (
        <p className="text-sm mt-2 p-3 bg-muted rounded-md">
          {description}
        </p>
      )}
    </>
  );
};

export default ReminderAction;
