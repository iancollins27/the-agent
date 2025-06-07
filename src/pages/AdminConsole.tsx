
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TestingTab from "@/components/admin/TestingTab";
import UserManagementTab from "@/components/admin/UserManagementTab";
import PromptManagementTab from "@/components/admin/PromptManagementTab";
import { UserMenu } from "@/components/UserMenu";
import IntegrationsTestTab from "@/components/admin/IntegrationsTestTab";

const AdminConsole = () => {
  const [activeTab, setActiveTab] = useState("prompts");

  return (
    <div className="min-h-screen bg-background">
      <UserMenu />
      
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Console</h1>
          <p className="text-muted-foreground mt-2">
            Manage prompts, track performance, and configure system settings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="integrations-test">Integration Tests</TabsTrigger>
          </TabsList>

          <TabsContent value="prompts">
            <PromptManagementTab />
          </TabsContent>
          <TabsContent value="testing">
            <TestingTab />
          </TabsContent>
          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>
          
          <TabsContent value="integrations-test">
            <IntegrationsTestTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminConsole;
