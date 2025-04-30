
import React from 'react';
import ExecutionsList from './execution-view/ExecutionsList';

const ExecutionsTab: React.FC = () => {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold tracking-tight">Agent Execution View</h2>
      <p className="text-muted-foreground">
        Track and analyze agent interactions and tool calls across your projects. 
        See each step your agents take and inspect tool input/output for debugging or optimization.
      </p>
      <ExecutionsList />
    </div>
  );
};

export default ExecutionsTab;
