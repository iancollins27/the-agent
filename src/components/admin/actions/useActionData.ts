
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { ActionRecord } from "@/components/Chat/types";
import { toast } from "sonner";

export const useActionData = (promptRunId: string | null) => {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActions = async () => {
    if (!promptRunId) return;

    setLoading(true);
    try {
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
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
      toast.error("Failed to load actions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (promptRunId) {
      fetchActions();
    } else {
      setActions([]);
    }
  }, [promptRunId]);

  // Update local state after approving or rejecting
  const updateActionStatus = (actionId: string, status: string, executedAt?: string) => {
    setActions(prev => 
      prev.map(action => 
        action.id === actionId ? { 
          ...action, 
          status, 
          executed_at: executedAt || action.executed_at 
        } : action
      )
    );
  };

  return {
    actions,
    loading,
    fetchActions,
    updateActionStatus
  };
};
