
import React, { useState } from 'react';
import MessageGenerator from './MessageGenerator';
import MessageViewer from './MessageViewer';
import { useMessageSender } from './MessageSender';
import { PromptRun } from '../../admin/types';
import { Send } from "lucide-react";

interface MultiProjectMessageProps {
  rooferName: string;
  projects: PromptRun[];
}

const MultiProjectMessage: React.FC<MultiProjectMessageProps> = ({ rooferName, projects }) => {
  const [consolidatedMessage, setConsolidatedMessage] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Extract projectIds and ensure they are valid strings
  const projectIds = projects
    .map(p => p.project_id)
    .filter((id): id is string => Boolean(id));

  const { sendMessage } = useMessageSender({
    rooferName,
    projectIds,
    message: consolidatedMessage
  });

  const handleMessageGenerated = (message: string) => {
    setConsolidatedMessage(message);
    setHasGenerated(true);
    setError(null);
  };

  const handleSendMessage = async () => {
    const success = await sendMessage();
    if (success) {
      setHasGenerated(false);
      setConsolidatedMessage('');
    }
  };

  return (
    <div className="flex space-x-2">
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      
      {!hasGenerated ? (
        <MessageGenerator
          rooferName={rooferName}
          projects={projects}
          onMessageGenerated={handleMessageGenerated}
        />
      ) : (
        <MessageViewer
          rooferName={rooferName}
          message={consolidatedMessage}
          onMessageChange={setConsolidatedMessage}
          onSendMessage={handleSendMessage}
        />
      )}
    </div>
  );
};

export default MultiProjectMessage;
