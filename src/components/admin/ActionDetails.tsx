
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { ActionRecord } from './types';

interface ActionDetailsProps {
  action: ActionRecord;
}

const ActionDetails: React.FC<ActionDetailsProps> = ({ action }) => {
  const timestamp = action.created_at 
    ? formatDistanceToNow(new Date(action.created_at), { addSuffix: true })
    : "Unknown";

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
