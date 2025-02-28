
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromptsTab from "@/components/admin/PromptsTab";
import TestingTab from "@/components/admin/TestingTab";

const AdminConsole = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Workflow Prompts Admin</h1>
        <p className="text-muted-foreground">Manage and test AI workflow prompts</p>
      </header>

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-6">
          <PromptsTab />
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <TestingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminConsole;
