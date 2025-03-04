
import React from 'react';
import { useLocation } from 'react-router-dom';
import ChatInterface from '@/components/Chat/ChatInterface';

const AgentChat: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const projectId = queryParams.get('projectId') || undefined;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">AI Project Assistant</h1>
      <p className="text-muted-foreground mb-6">
        Chat with our AI assistant to get information about projects, workflows, and more.
        You can refer to projects by their CRM ID or Project ID in your questions.
        {projectId && " Your conversation is already contextualized with the current project's data."}
      </p>
      <ChatInterface projectId={projectId} />
    </div>
  );
};

export default AgentChat;
