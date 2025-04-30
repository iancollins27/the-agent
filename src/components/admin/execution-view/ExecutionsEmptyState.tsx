
import React from 'react';
import { Bot } from "lucide-react";

const ExecutionsEmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-3 rounded-full bg-blue-100">
        <Bot className="h-6 w-6 text-blue-600" />
      </div>
      <h3 className="mt-2 text-lg font-medium text-gray-900">No Executions Found</h3>
      <p className="mt-1 text-sm text-gray-500">
        No agent executions match your current filters.
        <br />Try adjusting your filters or run a new agent session.
      </p>
    </div>
  );
};

export default ExecutionsEmptyState;
