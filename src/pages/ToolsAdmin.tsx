import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ProjectManagerNav from "../components/ProjectManagerNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Search, Wrench } from "lucide-react";

// Type definitions
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  enabled: boolean;
  category: string;
}

interface ToolCategory {
  id: string;
  name: string;
  description: string;
}

const ToolsAdmin = () => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [categories, setCategories] = useState<ToolCategory[]>([
    { id: 'chat', name: 'Chat Tools', description: 'Tools for the chat interface' },
    { id: 'workflow', name: 'Workflow Tools', description: 'Tools for workflow automation' }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    setIsLoading(true);
    try {
      // Fetch tool definitions from the agent-chat function
      const { data: chatTools, error: chatError } = await supabase.functions.invoke('agent-chat', {
        body: { getToolDefinitions: true }
      });

      if (chatError) throw chatError;

      // Fetch tool definitions from the test-workflow-prompt function
      const { data: workflowTools, error: workflowError } = await supabase.functions.invoke('test-workflow-prompt', {
        body: { getToolDefinitions: true }
      });

      if (workflowError) throw workflowError;

      // Process and combine tools with categories
      const processedTools = [
        ...(chatTools?.toolDefinitions || []).map((tool: any) => ({
          ...tool,
          enabled: true,
          category: 'chat'
        })),
        ...(workflowTools?.toolDefinitions || []).map((tool: any) => ({
          ...tool,
          enabled: true,
          category: 'workflow'
        }))
      ];

      setTools(processedTools);
    } catch (error) {
      console.error('Error fetching tools:', error);
      toast({
        variant: "destructive",
        title: "Failed to fetch tools",
        description: "There was an error fetching tool definitions."
      });
      setTools([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToolToggle = (toolName: string, enabled: boolean) => {
    setTools(prevTools => prevTools.map(tool => 
      tool.name === toolName ? { ...tool, enabled } : tool
    ));

    // In a real implementation, this would update the database or configuration
    toast({
      title: `${enabled ? 'Enabled' : 'Disabled'} ${toolName}`,
      description: `Tool has been ${enabled ? 'enabled' : 'disabled'}.`
    });
  };

  const filteredTools = tools.filter(tool => 
    (tool.category === activeCategory) && 
    (tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     tool.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Tools Management</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="flex flex-col">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={`text-left p-3 hover:bg-gray-100 transition-colors ${
                        activeCategory === category.id ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      {category.name}
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main content */}
          <div className="col-span-1 md:col-span-3">
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {categories.find(c => c.id === activeCategory)?.name || 'Tools'}
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tools..."
                      className="pl-8 w-[200px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTools.length === 0 ? (
                  <div className="text-center p-6 text-muted-foreground">
                    No tools found. Try a different search or category.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTools.map((tool) => (
                      <Card key={tool.name} className="overflow-hidden">
                        <div className="p-4 flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-medium">{tool.name.replace(/_/g, ' ')}</h3>
                            <p className="text-sm text-muted-foreground">{tool.description}</p>
                            <div className="mt-2">
                              <p className="text-xs font-medium">Required Parameters:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tool.parameters.required.map(param => (
                                  <span key={param} className="bg-gray-100 text-xs px-2 py-0.5 rounded">
                                    {param}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 min-w-[100px] justify-end">
                            <Switch
                              checked={tool.enabled}
                              onCheckedChange={(checked) => handleToolToggle(tool.name, checked)}
                              id={`tool-${tool.name}`}
                            />
                            <Label htmlFor={`tool-${tool.name}`}>
                              {tool.enabled ? 'Enabled' : 'Disabled'}
                            </Label>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsAdmin;
