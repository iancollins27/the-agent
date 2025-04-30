
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToolLog } from '../../types';
import ExecutionToolCall from '../ExecutionToolCall';

interface ToolLogsProps {
  toolLogs: ToolLog[];
}

const ToolLogs: React.FC<ToolLogsProps> = ({ toolLogs }) => {
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  // Add sequence numbers to tool logs
  const logsWithSequence = toolLogs.map((log, index) => ({
    ...log,
    sequence: index + 1
  }));

  const toggleExpanded = (id: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (toolLogs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No tool logs available for this execution.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">Tool Execution Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logsWithSequence.map(log => (
            <ExecutionToolCall
              key={log.id}
              toolLog={log}
              isExpanded={!!expandedLogs[log.id]}
              onToggle={() => toggleExpanded(log.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ToolLogs;
