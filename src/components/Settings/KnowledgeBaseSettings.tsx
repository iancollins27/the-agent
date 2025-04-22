
import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/providers/SettingsProvider";
import { KnowledgeBaseExplorer } from "./KnowledgeBaseExplorer";
import { KnowledgeBaseChat } from "./KnowledgeBaseChat";
import { supabase } from "@/integrations/supabase/client";

const KnowledgeBaseSettings: React.FC = () => {
  const { companySettings, updateCompanySettings } = useSettings();
  const [notionToken, setNotionToken] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notionPageId, setNotionPageId] = useState('');
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Get Notion settings from knowledge_base_settings.notion
    if (companySettings?.knowledge_base_settings && 
        typeof companySettings.knowledge_base_settings === 'object' && 
        companySettings.knowledge_base_settings !== null &&
        'notion' in companySettings.knowledge_base_settings) {
      const notionSettings = companySettings.knowledge_base_settings.notion;
      if (typeof notionSettings === 'object' && notionSettings !== null) {
        setNotionToken((notionSettings as any).token || '');
        setNotionDatabaseId((notionSettings as any).database_id || '');
        setNotionPageId((notionSettings as any).page_id || '');
      }
    }
  }, [companySettings]);

  // Safely access notion settings properties with type checking
  const getNotionSettingsSafely = () => {
    if (!companySettings?.knowledge_base_settings || 
        typeof companySettings.knowledge_base_settings !== 'object' ||
        companySettings.knowledge_base_settings === null ||
        !('notion' in companySettings.knowledge_base_settings)) {
      return { token: '', database_id: '', page_id: '', last_sync: null };
    }
    
    const notionSettings = companySettings.knowledge_base_settings.notion;
    
    if (typeof notionSettings !== 'object' || notionSettings === null) {
      console.warn('Notion settings is not an object:', notionSettings);
      return { token: '', database_id: '', page_id: '', last_sync: null };
    }
    
    return {
      token: (notionSettings as any).token || '',
      database_id: (notionSettings as any).database_id || '',
      page_id: (notionSettings as any).page_id || '',
      last_sync: (notionSettings as any).last_sync || null
    };
  };

  // Use safe accessor instead of direct property access
  const notionConfig = getNotionSettingsSafely();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update knowledge_base_settings.notion instead of notion_settings
      await updateCompanySettings({
        knowledge_base_settings: {
          notion: {
            token: notionToken,
            database_id: notionDatabaseId || null,
            page_id: notionPageId || null,
            last_sync: notionConfig.last_sync
          }
        }
      });
      
      toast({
        title: "Success",
        description: "Notion settings updated successfully.",
      });
    } catch (error) {
      console.error("Error updating Notion settings:", error);
      toast({
        title: "Error",
        description: "Failed to update Notion settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    if (!companySettings?.id) {
      toast({
        title: "Error",
        description: "Company settings not loaded yet",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      // Make sure we're passing the database ID in the correct format
      let databaseId = notionDatabaseId;
      // If ID contains hyphens but not in Notion's expected format, fix it
      if (databaseId && databaseId.includes('-')) {
        // Ensure consistent format for database IDs
        databaseId = databaseId.replace(/[-]/g, '');
        // Re-format with hyphens in correct positions if needed
        if (databaseId.length === 32) {
          databaseId = 
            databaseId.substring(0, 8) + '-' + 
            databaseId.substring(8, 12) + '-' + 
            databaseId.substring(12, 16) + '-' + 
            databaseId.substring(16, 20) + '-' + 
            databaseId.substring(20);
        }
        // Update the state with the formatted ID
        setNotionDatabaseId(databaseId);
      }
      
      const { data, error } = await supabase.functions.invoke('process-notion-integration', {
        body: {
          companyId: companySettings.id,
          notionToken: notionToken,
          notionDatabaseId: databaseId || null,
          notionPageId: notionPageId || null
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Notion sync started successfully. This may take a few minutes.",
      });
      
      // Update the last_sync time in settings
      const now = new Date().toISOString();
      await updateCompanySettings({
        knowledge_base_settings: {
          notion: {
            token: notionToken,
            database_id: databaseId || null,
            page_id: notionPageId || null,
            last_sync: now
          }
        }
      });
      
    } catch (error) {
      console.error("Error syncing with Notion:", error);
      toast({
        title: "Error",
        description: "Failed to start Notion sync: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mt-6 space-y-4">
        <h3 className="text-lg font-medium">Notion Integration</h3>
        
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="notion_token">Notion API Token</Label>
            <Input
              id="notion_token"
              type="password"
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              placeholder="Enter your Notion integration token"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="notion_database_id">Notion Database ID (Optional)</Label>
            <Input
              id="notion_database_id"
              value={notionDatabaseId}
              onChange={(e) => setNotionDatabaseId(e.target.value)}
              placeholder="Enter Notion database ID to sync"
            />
            <p className="text-sm text-muted-foreground">
              Format example: 19598163ae514377bbcf8e91de4a2156 or 19598163-ae51-4377-bbcf-8e91de4a2156
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="notion_page_id">Notion Page ID (Optional)</Label>
            <Input
              id="notion_page_id"
              value={notionPageId}
              onChange={(e) => setNotionPageId(e.target.value)}
              placeholder="Enter specific Notion page ID"
            />
          </div>
          
          <div className="flex space-x-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleSync} 
              disabled={isSyncing || !notionToken || !companySettings?.id}
            >
              {isSyncing ? "Syncing..." : "Sync with Notion"}
            </Button>
          </div>
          
          {notionConfig.last_sync && (
            <p className="text-sm text-gray-500">
              Last synced: {new Date(notionConfig.last_sync).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <KnowledgeBaseExplorer />
      <KnowledgeBaseChat />
    </div>
  );
};

export default KnowledgeBaseSettings;
