
import React, { useState } from 'react';
import ProjectManagerNav from '../components/ProjectManagerNav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import PromptsTab from '../components/admin/PromptsTab';
import ExecutionsTab from '../components/admin/ExecutionsTab';
import MCPConfigTab from '../components/admin/MCPConfigTab';

const AdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState('prompts');

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      <div className="container py-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
          </div>

          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white border">
              <TabsTrigger value="prompts">AI Prompts</TabsTrigger>
              <TabsTrigger value="executions">Executions</TabsTrigger>
              <TabsTrigger value="mcp">MCP Config</TabsTrigger>
            </TabsList>
            
            <TabsContent value="prompts">
              <PromptsTab />
            </TabsContent>
            
            <TabsContent value="executions">
              <ExecutionsTab />
            </TabsContent>
            
            <TabsContent value="mcp">
              <MCPConfigTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminConsole;
