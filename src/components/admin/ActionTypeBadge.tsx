
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Database, Calendar, RefreshCw, AlertCircle } from "lucide-react";

interface ActionTypeBadgeProps {
  type: string;
}

const ActionTypeBadge: React.FC<ActionTypeBadgeProps> = ({ type }) => {
  let variant: "default" | "outline" | "secondary" | "destructive" = "secondary";
  let icon = null;
  let label = type;

  switch (type) {
    case 'message':
      variant = "secondary";
      icon = <MessageSquare className="h-3.5 w-3.5 mr-1" />;
      label = "Message";
      break;
    case 'data_update':
      variant = "default";
      icon = <Database className="h-3.5 w-3.5 mr-1" />;
      label = "Data Update";
      break;
    case 'set_future_reminder':
      variant = "outline";
      icon = <Calendar className="h-3.5 w-3.5 mr-1" />;
      label = "Reminder";
      break;
    case 'timeline_update':
      variant = "outline";
      icon = <RefreshCw className="h-3.5 w-3.5 mr-1" />;
      label = "Timeline";
      break;
    default:
      variant = "secondary";
      icon = <AlertCircle className="h-3.5 w-3.5 mr-1" />;
      label = type.replace(/_/g, ' ');
  }

  return (
    <Badge variant={variant} className="flex items-center font-normal">
      {icon}
      {label}
    </Badge>
  );
};

export default ActionTypeBadge;
