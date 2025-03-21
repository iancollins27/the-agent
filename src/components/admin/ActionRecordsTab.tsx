
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ActionRecord } from "@/components/admin/types";
import ActionRecordsTable from "./ActionRecordsTable";

const ActionRecordsTab = () => {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionRecord | null>(null);
  const [executionNotes, setExecutionNotes] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('action_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching actions:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch action records."
        });
      } else {
        // Safely cast the data to ActionRecord[] since we've updated the type
        setActions(data as ActionRecord[] || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const filteredActions = actions.filter(action => {
    const searchTerms = searchQuery.toLowerCase().split(" ");
    return searchTerms.every(term =>
      action.action_type.toLowerCase().includes(term) ||
      (action.status && action.status.toLowerCase().includes(term)) ||
      (action.project_id && action.project_id.toLowerCase().includes(term)) ||
      (action.message && action.message.toLowerCase().includes(term)) ||
      (action.sender_name && action.sender_name.toLowerCase().includes(term)) ||
      (action.recipient_name && action.recipient_name.toLowerCase().includes(term))
    );
  });

  // Fix the type issue with setRowSelection
  const handleRowSelectionChange = (newSelection: Record<string, boolean>) => {
    setRowSelection(newSelection);
  };

  const selectedActionIds = Object.keys(rowSelection).filter(id => rowSelection[id]);

  const handleExecuteAction = async (record: ActionRecord) => {
    setSelectedAction(record);
  };

  const handleApproveAction = async (action: ActionRecord) => {
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('action_records')
        .update({
          status: 'approved',
          executed_at: new Date().toISOString()
        })
        .eq('id', action.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Action Approved",
        description: "The action has been approved successfully."
      });

      fetchActions();
    } catch (err: any) {
      console.error("Error approving action:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to approve action: ${err.message}`
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectAction = async (action: ActionRecord) => {
    setIsRejecting(true);
    try {
      const { error } = await supabase
        .from('action_records')
        .update({
          status: 'rejected'
        })
        .eq('id', action.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Action Rejected",
        description: "The action has been rejected successfully."
      });

      fetchActions();
    } catch (err: any) {
      console.error("Error rejecting action:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to reject action: ${err.message}`
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const confirmExecuteAction = async () => {
    if (!selectedAction) return;

    setIsExecuting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('execute-action', {
        body: {
          actionRecordId: selectedAction.id,
          notes: executionNotes
        }
      });

      if (error) {
        console.error("Function invoke error:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to execute action: ${error.message}`
        });
      } else {
        if (result?.error) {
          toast({
            variant: "destructive",
            title: "Execution Failed",
            description: result.error
          });
        } else {
          if (result.data?.execution_result) {
            const executionResult = result.data.execution_result;
            
            if (typeof executionResult === 'object' && executionResult !== null) {
              const success = 'success' in executionResult ? executionResult.success : undefined;
              const message = 'message' in executionResult ? executionResult.message : undefined;
              
              if (success === true) {
                toast({
                  title: "Action Executed Successfully",
                  description: message || "The action has been executed successfully.",
                });
              } else {
                toast({
                  variant: "destructive",
                  title: "Execution Failed",
                  description: message || "There was an error executing the action.",
                });
              }
            }
          }
          fetchActions();
        }
      }
    } catch (err: any) {
      console.error("Error executing action:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to execute action: ${err.message}`
      });
    } finally {
      setIsExecuting(false);
      setSelectedAction(null);
      setExecutionNotes("");
    }
  };

  const handleDeleteActions = async () => {
    if (selectedActionIds.length === 0) {
      toast({
        title: "No Actions Selected",
        description: "Please select at least one action to delete.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('action_records')
        .delete()
        .in('id', selectedActionIds);

      if (error) {
        console.error("Error deleting actions:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete action records."
        });
      } else {
        toast({
          title: "Actions Deleted",
          description: "Selected action records have been successfully deleted.",
        });
        setRowSelection({});
        fetchActions();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Action Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="search">Search:</Label>
            <Input
              id="search"
              type="text"
              placeholder="Search action records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ActionRecordsTable
            data={filteredActions}
            rowSelection={rowSelection}
            setRowSelection={handleRowSelectionChange}
            onApprove={handleApproveAction}
            onReject={handleRejectAction}
          />
          <div className="flex justify-between items-center">
            <Button
              variant="destructive"
              onClick={handleDeleteActions}
              disabled={isLoading || selectedActionIds.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : "Delete Selected Actions"}
            </Button>
            {selectedActionIds.length === 1 && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => handleExecuteAction(actions.find(action => action.id === selectedActionIds[0])!)}
                    disabled={isExecuting || selectedActionIds.length !== 1}
                  >
                    Execute Action
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Execute Action</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to execute this action?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="notes" className="text-right">
                        Notes
                      </Label>
                      <Textarea
                        id="notes"
                        className="col-span-3"
                        value={executionNotes}
                        onChange={(e) => setExecutionNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" onClick={confirmExecuteAction} disabled={isExecuting}>
                    {isExecuting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Executing...
                      </>
                    ) : "Execute"}
                  </Button>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActionRecordsTab;
