
import React from 'react';
import { Badge } from "@/components/ui/badge";

type PromptRunStatusBadgeProps = {
  status: string;
};

const PromptRunStatusBadge: React.FC<PromptRunStatusBadgeProps> = ({ status }) => {
  const getStatusBadgeStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'bg-green-500';
      case 'ERROR':
        return 'bg-red-500';
      case 'PENDING':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Badge className={getStatusBadgeStyle(status)}>
      {status}
    </Badge>
  );
};

export default PromptRunStatusBadge;
