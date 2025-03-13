
import React from 'react';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmptyStateMessageProps {
  message: string;
}

const EmptyStateMessage: React.FC<EmptyStateMessageProps> = ({ message }) => {
  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
};

export default EmptyStateMessage;
