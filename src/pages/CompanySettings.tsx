
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectManagerNav from "../components/ProjectManagerNav";
import KnowledgeBaseSettings from "../components/Settings/KnowledgeBaseSettings";
import CommunicationSettings from "../components/Settings/CommunicationSettings";
import { SettingsProvider } from "@/providers/SettingsProvider";
import AIProviderConfig from "../components/admin/AIProviderConfig";

const CompanySettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState("knowledge-base");

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <SettingsProvider>
        <div className="container mx-auto py-6">
          <h1 className="text-3xl font-bold mb-6">Company Settings</h1>
          
          <div className="mb-6">
            <AIProviderConfig />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full sm:w-[400px]">
              <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
              <TabsTrigger value="communications">Communication</TabsTrigger>
            </TabsList>
            
            <TabsContent value="knowledge-base">
              <KnowledgeBaseSettings />
            </TabsContent>
            
            <TabsContent value="communications">
              <CommunicationSettings />
            </TabsContent>
          </Tabs>
        </div>
      </SettingsProvider>
    </div>
  );
};

export default CompanySettings;
