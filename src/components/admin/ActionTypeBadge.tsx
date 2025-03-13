
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface ActionTypeBadgeProps {
  type: string;
}

const ActionTypeBadge: React.FC<ActionTypeBadgeProps> = ({ type }) => {
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

export default ActionTypeBadge;
