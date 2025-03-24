
import React from 'react';
import ChatInterface from '../components/Chat/ChatInterface';
import ProjectManagerNav from "../components/ProjectManagerNav";

const AgentChat: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      <ChatInterface />
    </div>
  );
};

export default AgentChat;
