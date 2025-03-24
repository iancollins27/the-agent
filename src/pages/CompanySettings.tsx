
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectManagerNav from "../components/ProjectManagerNav";
import KnowledgeBaseSettings from "../components/Settings/KnowledgeBaseSettings";

const CompanySettings: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState("knowledge-base");

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Company Settings</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-1 w-full sm:w-[200px]">
            <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
          </TabsList>
          
          <TabsContent value="knowledge-base">
            <KnowledgeBaseSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CompanySettings;
