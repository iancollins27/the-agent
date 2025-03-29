import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Company {
  id: string;
  knowledge_base_settings?: {
    notion?: {
      token?: string;
      database_id?: string;
      page_id?: string;
      last_sync?: string;
    };
  };
}

interface KnowledgeBaseSettingsProps {
  company: Company;
  onUpdate: (updates: any) => void | Promise<void>;
}

const KnowledgeBaseSettings: React.FC<KnowledgeBaseSettingsProps> = ({ company, onUpdate }) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [notionToken, setNotionToken] = useState(
    company.knowledge_base_settings?.notion?.token || ''
  );
  const [notionDatabaseId, setNotionDatabaseId] = useState(
    company.knowledge_base_settings?.notion?.database_id || ''
  );
  const [notionPageId, setNotionPageId] = useState(
    company.knowledge_base_settings?.notion?.page_id || ''
  );

  const lastSyncDate = company.knowledge_base_settings?.notion?.last_sync 
    ? new Date(company.knowledge_base_settings.notion.last_sync).toLocaleString()
    : 'Never';

  const handleNotionConnect = async () => {
    if (!notionToken) {
      toast({
        title: "Error",
        description: "Notion integration token is required",
        variant: "destructive",
      });
      return;
    }

    if (!notionDatabaseId && !notionPageId) {
      toast({
        title: "Error",
        description: "Please provide either a Notion database ID or page ID",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-notion-integration', {
        body: { 
          companyId: company.id,
          notionToken,
          notionDatabaseId: notionDatabaseId || null,
          notionPageId: notionPageId || null
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Notion knowledge base integration started",
      });
      
      // Refresh company data to get updated settings
      onUpdate({});
    } catch (error) {
      console.error('Error connecting to Notion:', error);
      toast({
        title: "Error",
        description: "Failed to connect to Notion",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge Base Integration</CardTitle>
        <CardDescription>
          Connect your company's knowledge base to enhance your AI assistant
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs defaultValue="notion">
          <TabsList>
            <TabsTrigger value="notion">Notion</TabsTrigger>
            <TabsTrigger value="other" disabled>Other Sources (Coming Soon)</TabsTrigger>
          </TabsList>

          <TabsContent value="notion" className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="notion-token">Notion Integration Token</Label>
              <Input 
                id="notion-token" 
                type="password"
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                placeholder="Enter your Notion integration token"
              />
              <p className="text-sm text-muted-foreground">
                Get your Notion integration token from the <a href="https://www.notion.so/my-integrations" className="text-primary hover:underline" target="_blank" rel="noreferrer">Notion Integrations page</a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notion-database-id">Notion Database ID (Optional)</Label>
              <Input 
                id="notion-database-id" 
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                placeholder="Enter your Notion database ID"
              />
              <p className="text-sm text-muted-foreground">
                Copy the ID from your Notion database URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notion-page-id">Notion Page ID (Optional)</Label>
              <Input 
                id="notion-page-id" 
                value={notionPageId}
                onChange={(e) => setNotionPageId(e.target.value)}
                placeholder="Enter your Notion page ID"
              />
              <p className="text-sm text-muted-foreground">
                Copy the ID from your Notion page URL
              </p>
            </div>

            {company.knowledge_base_settings?.notion?.last_sync && (
              <div className="rounded-md bg-gray-50 dark:bg-gray-900 p-4">
                <p className="text-sm font-medium">Last Synced: {lastSyncDate}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={isProcessing || !company.knowledge_base_settings?.notion?.last_sync}
          onClick={() => onUpdate({})}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button onClick={handleNotionConnect} disabled={isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Connect Notion
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default KnowledgeBaseSettings;
