
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import PromptsTab from "@/components/admin/PromptsTab";
import TestingTab from "@/components/admin/TestingTab";
import AIProviderConfig from "@/components/admin/AIProviderConfig";

const AdminConsole = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Prompts Admin</h1>
          <p className="text-muted-foreground">Manage and test AI workflow prompts</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <Link to="/chat">
              <MessageCircle className="h-4 w-4 mr-2" />
              Open Chat
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/chatbot-config">
              Configure Chatbot
            </Link>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="ai-provider">AI Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-6">
          <PromptsTab />
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <TestingTab />
        </TabsContent>

        <TabsContent value="ai-provider" className="space-y-6">
          <AIProviderConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminConsole;
