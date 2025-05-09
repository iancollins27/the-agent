
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionRecord } from "../types";
import { executeAction, rejectAction } from "./actionService";
import { useQueryClient } from '@tanstack/react-query';

interface CrmWriteActionProps {
  action: ActionRecord;
  onClose: () => void;
}

export const CrmWriteAction: React.FC<CrmWriteActionProps> = ({ action, onClose }) => {
  const queryClient = useQueryClient();
  const [isExecuting, setIsExecuting] = React.useState(false);
  
  const payload = action.action_payload as Record<string, any>;
  const { resource_type, operation_type, data } = payload;
  
  const handleApprove = async () => {
    setIsExecuting(true);
    try {
      await executeAction(action);
      queryClient.invalidateQueries({ queryKey: ['actionRecords'] });
      onClose();
    } catch (error) {
      console.error('Error executing action:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReject = async () => {
    setIsExecuting(true);
    try {
      await rejectAction(action.id);
      queryClient.invalidateQueries({ queryKey: ['actionRecords'] });
      onClose();
    } catch (error) {
      console.error('Error rejecting action:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const getOperationText = () => {
    switch (operation_type) {
      case 'create':
        return 'Create new';
      case 'update':
        return 'Update existing';
      case 'delete':
        return 'Delete';
      default:
        return operation_type;
    }
  };

  const renderDataItems = () => {
    return Object.entries(data || {}).map(([key, value]) => (
      <div key={key} className="flex flex-col mb-2 border-b pb-2">
        <span className="text-sm font-medium text-gray-500">{key}</span>
        <span className="text-md">{String(value)}</span>
      </div>
    ));
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>CRM Write Operation</span>
          <Badge variant={operation_type === 'delete' ? 'destructive' : 'default'}>
            {getOperationText()}
          </Badge>
        </CardTitle>
        <CardDescription>
          {getOperationText()} {resource_type} record in the CRM system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Resource Type</h3>
            <p className="capitalize">{resource_type}</p>
          </div>
          
          {payload.resource_id && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Resource ID</h3>
              <p className="font-mono text-sm">{payload.resource_id}</p>
            </div>
          )}
          
          {operation_type !== 'delete' && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Data to Write</h3>
              <div className="bg-gray-50 p-4 rounded-md">
                {renderDataItems()}
              </div>
            </div>
          )}
          
          <div>
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p>{payload.description || action.message || 'No description provided'}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          onClick={handleReject}
          variant="outline"
          disabled={isExecuting}
        >
          Reject
        </Button>
        <Button 
          onClick={handleApprove}
          disabled={isExecuting}
          variant={operation_type === 'delete' ? 'destructive' : 'default'}
        >
          Approve
        </Button>
      </CardFooter>
    </Card>
  );
};
