
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { XCircle } from "lucide-react";

interface ErrorAlertProps {
  error: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ error }) => {
  if (!error) return null;
  
  // Check if the error contains "maximum iterations" and provide a more helpful message
  const isMaxIterationsError = error.toLowerCase().includes("maximum") && 
                               error.toLowerCase().includes("iterations");
  
  return (
    <Alert variant="destructive" className="text-sm">
      <XCircle className="h-4 w-4 mr-2" />
      <AlertDescription>
        {error}
        {isMaxIterationsError && (
          <div className="mt-2">
            <strong>Troubleshooting:</strong> This error typically occurs when there are issues with tool execution.
            Try the following:
            <ul className="list-disc ml-4 mt-1">
              <li>Check that your prompt is clear and well-structured</li>
              <li>Verify that required fields like projectId are correctly set</li>
              <li>If the issue persists, try running without MCP mode</li>
            </ul>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default ErrorAlert;
