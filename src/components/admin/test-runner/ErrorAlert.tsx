
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ErrorAlertProps {
  error: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ error }) => {
  if (!error) return null;
  
  return (
    <Alert variant="destructive" className="text-sm">
      <AlertDescription>
        {error}
      </AlertDescription>
    </Alert>
  );
};

export default ErrorAlert;
