
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectManagerNav from "../components/ProjectManagerNav";
import ActionRecordsTab from "../components/admin/ActionRecordsTab";
import PromptsTab from "../components/admin/PromptsTab";
import TestingTab from "../components/admin/TestingTab";
import PromptRunsTab from "../components/admin/PromptRunsTab";
import FeedbackTab from "../components/admin/FeedbackTab";
import MCPConfigTab from "../components/admin/MCPConfigTab";
import { ObservabilityTab } from "../components/admin/observability/ObservabilityTab";
import { Routes, Route, Outlet, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import ExecutionsList from "../components/admin/execution-view/ExecutionsList";
import ExecutionView from "../components/admin/execution-view/ExecutionView";

const AdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState("prompt-runs");
  const location = useLocation();

  // Function to render the admin content based on routes 
  // outside of the tabbed interface (used for execution view)
  const renderContent = () => {
    // If we're on a specific execution path, render that view
    if (location.pathname.includes('/admin/executions/')) {
      return <Outlet />;
    }
    
    // Otherwise render the tabbed interface
    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full sm:w-[800px]" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
          <TabsTrigger value="prompt-runs">Prompt Runs</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="observability">Metrics</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="mcp">MCP</TabsTrigger>
        </TabsList>
        
        <TabsContent value="prompt-runs">
          <PromptRunsTab />
        </TabsContent>
        
        <TabsContent value="actions">
          <ActionRecordsTab />
        </TabsContent>
        
        <TabsContent value="prompts">
          <PromptsTab />
        </TabsContent>
        
        <TabsContent value="testing">
          <TestingTab />
        </TabsContent>
        
        <TabsContent value="feedback">
          <FeedbackTab />
        </TabsContent>

        <TabsContent value="observability">
          <ObservabilityTab />
        </TabsContent>

        <TabsContent value="executions">
          <ExecutionsList />
        </TabsContent>
        
        <TabsContent value="mcp">
          <MCPConfigTab />
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Admin Console</h1>
          
          {location.pathname.includes('/admin/executions/') && (
            <NavLink 
              to="/admin"
              onClick={() => setActiveTab("executions")}
              className={({ isActive }) => cn(
                "inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md"
              )}
            >
              Back to Executions List
            </NavLink>
          )}
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminConsole;
