
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ChatInterface from '../components/Chat/ChatInterface';
import ProjectManagerNav from "../components/ProjectManagerNav";

const AgentChat: React.FC = () => {
  // Extract project ID from URL query parameters if present
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const projectId = query.get('projectId');
  
  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      <ChatInterface projectId={projectId || undefined} />
    </div>
  );
};

export default AgentChat;
