
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectManagerNav from "../components/ProjectManagerNav";
import JobProgressTestPanel from "../components/integration/JobProgressTestPanel";
import ZohoTestPanel from "../components/integration/ZohoTestPanel";
import IntegrationStatusDashboard from "../components/integration/IntegrationStatusDashboard";

const IntegrationTesting: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Integration Testing</h1>
        </div>
        
        <Tabs defaultValue="status" className="space-y-4">
          <TabsList className="grid w-full sm:w-[600px]" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="jobprogress">JobProgress</TabsTrigger>
            <TabsTrigger value="zoho">Zoho</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status">
            <IntegrationStatusDashboard />
          </TabsContent>
          
          <TabsContent value="jobprogress">
            <JobProgressTestPanel />
          </TabsContent>
          
          <TabsContent value="zoho">
            <ZohoTestPanel />
          </TabsContent>
          
          <TabsContent value="general">
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">General Integration Tools</h3>
              <p className="text-muted-foreground">General integration testing tools will be available here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default IntegrationTesting;
