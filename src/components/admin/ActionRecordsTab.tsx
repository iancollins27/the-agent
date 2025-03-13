
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ActionRecord } from '@/components/Chat/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, AlertCircle, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ActionRecordsTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Fetch pending action records
  const { data: actionRecords, isLoading, error } = useQuery({
    queryKey: ['actionRecords', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_records')
        .select(`
          *,
          projects(id, crm_id),
          recipient:recipient_id(id, full_name)
        `)
        .eq('status', 'pending')
        .eq('requires_approval', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Format and add project name
      return data.map(record => ({
        ...record,
        project_name: record.projects?.crm_id || 'Unknown Project',
        recipient_name: record.recipient?.full_name || record.action_payload?.recipient || 'No Recipient'
      })) as ActionRecord[];
    },
  });

  // Approve action record mutation
  const approveActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      setProcessingAction(actionId);
      
      // 1. First update the action record with approval
      const { error: updateError } = await supabase
        .from('action_records')
        .update({
          status: 'approved',
          approver_id: user?.id
        })
        .eq('id', actionId);
      
      if (updateError) throw updateError;
      
      // 2. Call execution function (this would normally be a webhook/function call)
      // Simulating execution for now
      const { error: executeError } = await supabase
        .from('action_records')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
          execution_result: { success: true, message: 'Action executed successfully' }
        })
        .eq('id', actionId);
        
      if (executeError) throw executeError;
      
      return actionId;
    },
    onSuccess: (actionId) => {
      const action = actionRecords?.find(a => a.id === actionId);
      const recipient = action?.recipient_name || action?.action_payload?.recipient || 'the recipient';
      const messageText = action?.message || 'Message';
      
      toast({
        title: "Action Approved & Executed",
        description: `Message sent to ${recipient}`,
      });
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['actionRecords'] });
      setProcessingAction(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to approve action: ${error.message}`,
      });
      setProcessingAction(null);
    }
  });

  // Function to handle action approval
  const handleApprove = (actionId: string) => {
    approveActionMutation.mutate(actionId);
  };

  // Function to get action type display
  const getActionTypeDisplay = (type: string) => {
    switch (type) {
      case 'message':
        return <Badge variant="secondary">Message</Badge>;
      case 'data_update':
        return <Badge>Data Update</Badge>;
      case 'request_for_data_update':
        return <Badge variant="outline">Request Data</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Function to format created date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading action records: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!actionRecords || actionRecords.length === 0) {
    return (
      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertDescription>
          No pending actions requiring approval at this time.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actionRecords.map((action) => (
              <TableRow key={action.id}>
                <TableCell>{getActionTypeDisplay(action.action_type)}</TableCell>
                <TableCell>{action.project_name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {action.action_payload.description || 
                   'No description provided'}
                </TableCell>
                <TableCell>{formatDate(action.created_at)}</TableCell>
                <TableCell>{action.recipient_name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {action.message || action.action_payload.message_content || 'N/A'}
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    onClick={() => handleApprove(action.id)}
                    disabled={processingAction === action.id}
                    size="sm"
                  >
                    {processingAction === action.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ActionRecordsTab;
