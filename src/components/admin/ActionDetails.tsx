
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from 'lucide-react';
import { format, isValid, parseISO, differenceInDays } from 'date-fns';
import { ActionRecord } from './types';

interface ActionDetailsProps {
  action: ActionRecord;
}

const ActionDetails: React.FC<ActionDetailsProps> = ({ action }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'Unknown';
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      return 'Unknown';
    }
  };

  const formatReminderDetails = () => {
    if (!action.action_type.includes('reminder')) return null;
    
    const actionPayload = action.action_payload as Record<string, any>;
    const daysUntilCheck = actionPayload?.days_until_check;
    const reminderDate = action.reminder_date;
    
    if (reminderDate) {
      const reminderDateTime = new Date(reminderDate);
      const now = new Date();
      const daysFromNow = differenceInDays(reminderDateTime, now);
      
      return {
        daysUntilCheck,
        reminderDate: reminderDateTime,
        daysFromNow,
        isOverdue: daysFromNow < 0,
        formattedDate: format(reminderDateTime, 'PPP p')
      };
    }
    
    return { daysUntilCheck };
  };

  const timestamp = formatDate(action.created_at);

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "executed":
        return "default";
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const isReminderAction = action.action_type.includes('reminder');
  const reminderDetails = formatReminderDetails();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard title="Basic Information">
          <InfoItem label="Type" value={<Badge variant="outline" className="capitalize">{action.action_type?.replace(/_/g, ' ') || 'Unknown'}</Badge>} />
          <InfoItem label="Status" value={
            <Badge 
              variant={getStatusBadgeVariant(action.status) as any}
              className="capitalize"
            >
              {action.status}
            </Badge>
          } />
          <InfoItem label="Created" value={timestamp} />
          <InfoItem label="Project" value={action.project_name || 'N/A'} />
        </InfoCard>

        <InfoCard title="People">
          <InfoItem label="Recipient" value={action.recipient_name || 'N/A'} />
          <InfoItem label="Sender" value={action.sender_name || 'System'} />
          {action.approver_id && (
            <InfoItem label="Approved by" value={action.approver_name || action.approver_id} />
          )}
        </InfoCard>
      </div>

      {/* Enhanced Reminder Information Section */}
      {isReminderAction && reminderDetails && (
        <InfoCard title="Reminder Details">
          {reminderDetails.daysUntilCheck && (
            <InfoItem 
              label="Days Until Check" 
              value={
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-amber-600">
                    {reminderDetails.daysUntilCheck} day{reminderDetails.daysUntilCheck === 1 ? '' : 's'}
                  </span>
                </div>
              } 
            />
          )}
          
          {reminderDetails.reminderDate && (
            <InfoItem 
              label="Reminder Date & Time" 
              value={
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-600">
                    {reminderDetails.formattedDate}
                  </span>
                </div>
              } 
            />
          )}
          
          {reminderDetails.reminderDate && (
            <InfoItem 
              label="Status" 
              value={
                <Badge 
                  variant={reminderDetails.isOverdue ? "destructive" : reminderDetails.daysFromNow === 0 ? "default" : "secondary"}
                  className="capitalize"
                >
                  {reminderDetails.isOverdue 
                    ? `${Math.abs(reminderDetails.daysFromNow)} days overdue`
                    : reminderDetails.daysFromNow === 0
                      ? 'Due today'
                      : `${reminderDetails.daysFromNow} days remaining`
                  }
                </Badge>
              } 
            />
          )}
        </InfoCard>
      )}

      <InfoCard title="Message Content">
        <div className="whitespace-pre-wrap p-3 border rounded-md bg-muted/50">
          {action.message || 'No message content'}
        </div>
      </InfoCard>

      {action.action_payload && typeof action.action_payload === 'object' && (
        <InfoCard title="Action Payload">
          <pre className="text-xs overflow-auto p-3 border rounded-md bg-muted/50">
            {JSON.stringify(action.action_payload, null, 2)}
          </pre>
        </InfoCard>
      )}

      {action.execution_result && (
        <InfoCard title="Execution Result">
          <pre className="text-xs overflow-auto p-3 border rounded-md bg-muted/50">
            {JSON.stringify(action.execution_result, null, 2)}
          </pre>
        </InfoCard>
      )}
    </div>
  );
};

// Helper components
const InfoCard: React.FC<{title: string, children: React.ReactNode}> = ({ title, children }) => (
  <Card>
    <CardContent className="p-4">
      <h3 className="font-medium mb-3">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
    </CardContent>
  </Card>
);

const InfoItem: React.FC<{label: string, value: React.ReactNode}> = ({ label, value }) => (
  <div>
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="font-medium">{value}</div>
    <Separator className="mt-2" />
  </div>
);

export default ActionDetails;
