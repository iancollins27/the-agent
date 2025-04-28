
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import ProjectManagerNav from "../ProjectManagerNav";

interface ProjectManagerLayoutProps {
  children: React.ReactNode;
}

const ProjectManagerLayout: React.FC<ProjectManagerLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      <div className="container mx-auto py-6 space-y-6">
        {children}
      </div>
    </div>
  );
};

export default ProjectManagerLayout;
