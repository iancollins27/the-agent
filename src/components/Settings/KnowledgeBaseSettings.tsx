
import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/providers/SettingsProvider";

const KnowledgeBaseSettings: React.FC = () => {
  const { companySettings, updateCompanySettings } = useSettings();
  const [notionToken, setNotionToken] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notionPageId, setNotionPageId] = useState('');
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (companySettings?.notion_settings) {
      const settings = companySettings.notion_settings;
      setNotionToken(settings.token || '');
      setNotionDatabaseId(settings.database_id || '');
      setNotionPageId(settings.page_id || '');
    }
  }, [companySettings]);

  // Safely access notion settings properties with type checking
  const getNotionSettingsSafely = (settings: any) => {
    if (!settings) return { token: '', database_id: '', page_id: '', last_sync: null };
    
    if (Array.isArray(settings)) {
      console.warn('Notion settings is unexpectedly an array:', settings);
      return { token: '', database_id: '', page_id: '', last_sync: null };
    }
    
    if (typeof settings !== 'object') {
      console.warn('Notion settings is not an object:', settings);
      return { token: '', database_id: '', page_id: '', last_sync: null };
    }
    
    return {
      token: settings.token || '',
      database_id: settings.database_id || '',
      page_id: settings.page_id || '',
      last_sync: settings.last_sync || null
    };
  };

  // Use safe accessor instead of direct property access
  const notionConfig = getNotionSettingsSafely(companySettings?.notion_settings);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...companySettings,
        notion_settings: {
          token: notionToken,
          database_id: notionDatabaseId,
          page_id: notionPageId
        }
      };
      
      await updateCompanySettings(updatedSettings);
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
          <Label htmlFor="notion_database_id">Notion Database ID</Label>
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
            placeholder="Enter specific Notion page ID (optional)"
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
