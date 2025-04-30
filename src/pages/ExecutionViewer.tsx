
import React from 'react';
import ProjectManagerNav from "../components/ProjectManagerNav";
import ExecutionView from '../components/admin/execution-view/ExecutionView';

const ExecutionViewer: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      <div className="container mx-auto py-6">
        <ExecutionView />
      </div>
    </div>
  );
};

export default ExecutionViewer;
