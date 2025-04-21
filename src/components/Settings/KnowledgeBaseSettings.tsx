
import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/providers/SettingsProvider";

const KnowledgeBaseSettings: React.FC = () => {
  const { companySettings, updateCompanySettings } = useSettings();
  const [notionToken, setNotionToken] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notionPageId, setNotionPageId] = useState('');
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Get Notion settings from knowledge_base_settings.notion
    if (companySettings?.knowledge_base_settings?.notion) {
      const notionSettings = companySettings.knowledge_base_settings.notion;
      setNotionToken(notionSettings.token || '');
      setNotionDatabaseId(notionSettings.database_id || '');
      setNotionPageId(notionSettings.page_id || '');
    }
  }, [companySettings]);

  // Safely access notion settings properties with type checking
  const getNotionSettingsSafely = () => {
    if (!companySettings?.knowledge_base_settings?.notion) {
      return { token: '', database_id: '', page_id: '', last_sync: null };
    }
    
    const notionSettings = companySettings.knowledge_base_settings.notion;
    
    if (typeof notionSettings !== 'object') {
      console.warn('Notion settings is not an object:', notionSettings);
      return { token: '', database_id: '', page_id: '', last_sync: null };
    }
    
    return {
      token: notionSettings.token || '',
      database_id: notionSettings.database_id || '',
      page_id: notionSettings.page_id || '',
      last_sync: notionSettings.last_sync || null
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

  return (
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
        
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default KnowledgeBaseSettings;
