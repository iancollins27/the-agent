
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ActionRecord } from './types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTimeFilter } from '@/hooks/useTimeFilter';
import TimeFilterSelect from './TimeFilterSelect';
import { ActionRecordsTable } from './ActionRecordsTable';
import EmptyStateMessage from './EmptyStateMessage';

const ActionRecordsTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const { timeFilter, setTimeFilter, getDateFilter, getTimeFilterLabel } = useTimeFilter();

  const { data: actionRecords, isLoading, error } = useQuery({
    queryKey: ['actionRecords', 'pending', timeFilter],
    queryFn: async () => {
      let query = supabase
        .from('action_records')
        .select(`
          *,
          projects(id, crm_id),
          recipient:contacts!recipient_id(id, full_name)
        `)
        .eq('status', 'pending')
        .eq('requires_approval', true)
        .order('created_at', { ascending: false });
      
      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map(record => ({
        ...record,
        project_name: record.projects?.crm_id || 'Unknown Project',
        recipient_name: record.recipient?.full_name || 
                        (record.action_payload && typeof record.action_payload === 'object' && 'recipient' in record.action_payload ? 
                        record.action_payload.recipient : 'No Recipient')
      })) as ActionRecord[];
    },
  });

  const approveActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      setProcessingAction(actionId);
      
      const { error: updateError } = await supabase
        .from('action_records')
        .update({
          status: 'approved',
          approver_id: user?.id
        })
        .eq('id', actionId);
      
      if (updateError) throw updateError;
      
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
      const recipient = action?.recipient_name || 
                       (action?.action_payload && typeof action.action_payload === 'object' && 'recipient' in action.action_payload ? 
                       action.action_payload.recipient : 'the recipient');
      
      toast({
        title: "Action Approved & Executed",
        description: `Message sent to ${recipient}`,
      });
      
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

  const handleApprove = (actionId: string) => {
    approveActionMutation.mutate(actionId);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['actionRecords'] });
    toast({
      title: "Update applied",
      description: "The action record has been updated successfully."
    });
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Pending Actions</h3>
        <TimeFilterSelect 
          value={timeFilter} 
          onChange={(value) => setTimeFilter(value)} 
        />
      </div>
      
      {!actionRecords || actionRecords.length === 0 ? (
        <EmptyStateMessage 
          message={`No pending actions requiring approval ${timeFilter !== 'all' ? 
            `in the ${getTimeFilterLabel(timeFilter).toLowerCase()}` : ''}.`} 
        />
      ) : (
        <ActionRecordsTable data={actionRecords} />
      )}
    </div>
  );
};

export default ActionRecordsTab;
