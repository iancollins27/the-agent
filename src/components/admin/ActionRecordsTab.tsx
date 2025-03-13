
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ActionRecord } from './types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, AlertCircle, Info, Loader2, Clock } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addHours, subHours, format } from 'date-fns';
import ActionRecordEdit from './ActionRecordEdit';

const TIME_FILTERS = {
  LAST_HOUR: 'last_hour',
  LAST_24_HOURS: 'last_24_hours',
  LAST_7_DAYS: 'last_7_days',
  ALL: 'all'
};

const ActionRecordsTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.LAST_HOUR);

  const getDateFilter = () => {
    const now = new Date();
    switch (timeFilter) {
      case TIME_FILTERS.LAST_HOUR:
        return subHours(now, 1).toISOString();
      case TIME_FILTERS.LAST_24_HOURS:
        return subHours(now, 24).toISOString();
      case TIME_FILTERS.LAST_7_DAYS:
        return subHours(now, 168).toISOString();
      case TIME_FILTERS.ALL:
      default:
        return null;
    }
  };

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
      const messageText = action?.message || 'Message';
      
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getTimeFilterLabel = (filter: string) => {
    switch (filter) {
      case TIME_FILTERS.LAST_HOUR:
        return 'Last Hour';
      case TIME_FILTERS.LAST_24_HOURS:
        return 'Last 24 Hours';
      case TIME_FILTERS.LAST_7_DAYS:
        return 'Last 7 Days';
      case TIME_FILTERS.ALL:
        return 'All Time';
      default:
        return 'Unknown Filter';
    }
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select 
            value={timeFilter} 
            onValueChange={(value) => setTimeFilter(value)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TIME_FILTERS.LAST_HOUR}>
                <div className="flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  Last Hour
                </div>
              </SelectItem>
              <SelectItem value={TIME_FILTERS.LAST_24_HOURS}>Last 24 Hours</SelectItem>
              <SelectItem value={TIME_FILTERS.LAST_7_DAYS}>Last 7 Days</SelectItem>
              <SelectItem value={TIME_FILTERS.ALL}>All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {!actionRecords || actionRecords.length === 0 ? (
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            No pending actions requiring approval {timeFilter !== TIME_FILTERS.ALL ? `in the ${getTimeFilterLabel(timeFilter).toLowerCase()}` : ''}.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[150px]">Project</TableHead>
                <TableHead className="w-[200px]">Description</TableHead>
                <TableHead className="w-[150px]">Created</TableHead>
                <TableHead className="w-[150px]">Recipient</TableHead>
                <TableHead className="max-w-[250px]">Message</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actionRecords.map((action) => (
                <TableRow key={action.id}>
                  <TableCell>{getActionTypeDisplay(action.action_type)}</TableCell>
                  <TableCell>{action.project_name}</TableCell>
                  <TableCell>
                    {action.action_payload && typeof action.action_payload === 'object' && 'description' in action.action_payload ? 
                     action.action_payload.description : 'No description provided'}
                  </TableCell>
                  <TableCell>{action.created_at ? formatDate(action.created_at) : 'Unknown'}</TableCell>
                  <TableCell>
                    <ActionRecordEdit 
                      record={action}
                      field="recipient_name"
                      onSuccess={handleEditSuccess}
                    />
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <ActionRecordEdit 
                      record={action}
                      field="message"
                      onSuccess={handleEditSuccess}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
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
      )}
    </div>
  );
};

export default ActionRecordsTab;
