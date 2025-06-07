
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TestingTab from "@/components/admin/TestingTab";
import UserMenu from "@/components/UserMenu";
import IntegrationsTestTab from "@/components/admin/IntegrationsTestTab";

const AdminConsole = () => {
  const [activeTab, setActiveTab] = useState("integrations-test");

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="integrations-test">Integration Tests</TabsTrigger>
          </TabsList>

          <TabsContent value="testing">
            <TestingTab />
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
