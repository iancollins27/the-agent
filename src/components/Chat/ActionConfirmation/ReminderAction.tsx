
import React from 'react';
import { CalendarClock } from "lucide-react";

interface ReminderActionProps {
  daysUntilCheck: number;
  checkReason: string;
  description?: string;
}

const ReminderAction: React.FC<ReminderActionProps> = ({ daysUntilCheck, checkReason, description }) => {
  const checkDate = new Date();
  checkDate.setDate(checkDate.getDate() + daysUntilCheck);
  
  return (
    <div className="space-y-2">
      {description && (
        <p className="text-sm p-3 bg-muted rounded-md">{description}</p>
      )}
      <div className="flex items-center gap-2 text-sm text-blue-700 p-2 bg-blue-50 rounded-md">
        <CalendarClock className="h-4 w-4" />
        <span>
          {daysUntilCheck === 0 
            ? "Set reminder for today" 
            : daysUntilCheck === 1 
              ? "Set reminder for tomorrow" 
              : `Set reminder for ${daysUntilCheck} days from now`}
        </span>
      </div>
      <div className="text-sm">
        <div className="font-medium mb-1">Reason for follow-up:</div>
        <p className="p-2 bg-gray-50 rounded">{checkReason}</p>
      </div>
      <div className="text-sm text-muted-foreground">
        Scheduled date: {checkDate.toLocaleDateString()}
      </div>
    </div>
  );
};

export default ReminderAction;
