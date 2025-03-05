
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import ChatInterface from '@/components/Chat/ChatInterface';

const AgentChat: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const projectId = queryParams.get('projectId') || undefined;

  return (
    <div className="container mx-auto p-4 max-w-4xl h-[calc(100vh-2rem)]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI Project Assistant</h1>
        <Button variant="outline" asChild>
          <Link to="/chatbot-config">
            <Settings className="h-4 w-4 mr-2" />
            Configure Chatbot
          </Link>
        </Button>
      </div>
      
      <p className="text-muted-foreground mb-6">
        Chat with our AI assistant to get information about projects, workflows, and more.
        You can refer to projects by their CRM ID or Project ID in your questions.
        {projectId && " Your conversation is already contextualized with the current project's data."}
      </p>
      <div className="h-[calc(100vh-12rem)]">
        <ChatInterface projectId={projectId} className="h-full" />
      </div>
    </div>
  );
};

export default AgentChat;
