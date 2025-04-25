
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectManagerNav from "../components/ProjectManagerNav";
import ActionRecordsTab from "../components/admin/ActionRecordsTab";
import PromptsTab from "../components/admin/PromptsTab";
import TestingTab from "../components/admin/TestingTab";
import PromptRunsTab from "../components/admin/PromptRunsTab";
import FeedbackTab from "../components/admin/FeedbackTab";

const AdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState("prompt-runs");

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Admin Console</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full sm:w-[750px]">
            <TabsTrigger value="prompt-runs">Prompt Runs</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
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
        </Tabs>
      </div>
    </div>
  );
};

export default AdminConsole;
