
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { ActionRecord } from '@/components/admin/types';
import { Button } from '@/components/ui/button';
import ActionTypeBadge from '../../ActionTypeBadge';

interface ActionRecordsProps {
  promptRunId: string;
}

const ActionRecords: React.FC<ActionRecordsProps> = ({ promptRunId }) => {
  const { data: actions, isLoading, error } = useQuery({
    queryKey: ['action-records', promptRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_records')
        .select(`
          *,
          recipient:contacts!recipient_id(id, full_name, phone_number, email),
          sender:contacts!sender_ID(id, full_name, phone_number, email)
        `)
        .eq('prompt_run_id', promptRunId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ActionRecord[];
    },
    enabled: !!promptRunId,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading action records...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error Loading Actions</AlertTitle>
        <AlertDescription>
          There was a problem loading the action records: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <Alert>
        <Info className="h-5 w-5" />
        <AlertTitle>No Actions Found</AlertTitle>
        <AlertDescription>
          No action records were created during this prompt run.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        {actions.length} action record{actions.length !== 1 ? 's' : ''} created during this prompt run:
      </h3>
      
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
                
                {action.action_type === 'message' && (
                  <div className="text-sm line-clamp-2">
                    {action.message || 
                      (typeof action.action_payload === 'object' && action.action_payload !== null ? 
                        (action.action_payload as any).message_content || 
                        (action.action_payload as any).content || 
                        "No message content" 
                      : "No message content")}
                  </div>
                )}
                
                {action.action_type === 'data_update' && (
                  <div className="text-sm">
                    Update <span className="font-medium">
                      {typeof action.action_payload === 'object' && action.action_payload !== null ? 
                        (action.action_payload as any).field : 'unknown field'}
                    </span> to{' '}
                    <span className="font-medium">
                      {typeof action.action_payload === 'object' && action.action_payload !== null ? 
                        (action.action_payload as any).value : 'unknown value'}
                    </span>
                  </div>
                )}
                
                {/* Display communication parties for message actions */}
                {action.action_type === 'message' && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <span>From: <span className="font-medium">
                      {action.sender?.full_name || action.sender_name || "Unknown sender"}
                    </span></span>
                    <span className="mx-1">→</span>
                    <span>To: <span className="font-medium">
                      {action.recipient?.full_name || action.recipient_name || "Unknown recipient"}
                    </span></span>
                  </div>
                )}
                
                {/* Status badge */}
                <div className="text-xs font-medium">
                  Status: <span className={
                    action.status === 'approved' ? 'text-green-600' : 
                    action.status === 'rejected' ? 'text-red-600' : 
                    'text-amber-600'
                  }>
                    {action.status.toUpperCase()}
                  </span>
                  {action.executed_at && (
                    <span className="ml-2 text-muted-foreground">
                      (Executed: {new Date(action.executed_at).toLocaleString()})
                    </span>
                  )}
                </div>
              </div>
              
              {/* View in Actions Button */}
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.open(`/admin?tab=actions&id=${action.id}`, '_blank')}
              >
                View in Actions
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ActionRecords;
