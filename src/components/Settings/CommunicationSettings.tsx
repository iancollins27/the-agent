
import React, { useState, useEffect } from 'react';
import { useSettings } from "@/providers/SettingsProvider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Json } from "@/integrations/supabase/types";

// Change to default export
export default function CommunicationSettings() {
  const { companySettings, updateCompanySettings } = useSettings();
  const [isEmailEnabled, setIsEmailEnabled] = useState(false);
  const [isSmsEnabled, setIsSmsEnabled] = useState(false);
  const [isCrmEnabled, setIsCrmEnabled] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState<string | undefined>(companySettings?.default_email_provider);
  
  useEffect(() => {
    // Fix TypeScript errors by properly checking and casting the communication_settings
    const commSettings = companySettings?.communication_settings as Record<string, boolean> | undefined;
    setIsEmailEnabled(commSettings?.email_enabled === true);
    setIsSmsEnabled(commSettings?.sms_enabled === true);
    setIsCrmEnabled(commSettings?.crm_enabled === true);
    setDefaultProvider(companySettings?.default_email_provider);
  }, [companySettings]);

  const handleSettingsUpdate = async () => {
    const updates = {
      communication_settings: {
        email_enabled: isEmailEnabled,
        sms_enabled: isSmsEnabled,
        crm_enabled: isCrmEnabled,
      },
      default_email_provider: defaultProvider,
    };
    await updateCompanySettings(updates);
  };
  
  // Replace the problematic comparison with a correct type check
  const defaultEmailChecked = defaultProvider === 'email';
  const defaultSmsChecked = defaultProvider === 'sms';
  const defaultCrmChecked = defaultProvider === 'crm';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Communication Settings</CardTitle>
        <CardDescription>
          Configure communication channels and default providers for your company.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center space-x-2">
          <Label htmlFor="email">Enable Email</Label>
          <Switch
            id="email"
            checked={isEmailEnabled}
            onCheckedChange={(checked) => setIsEmailEnabled(checked)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="sms">Enable SMS</Label>
          <Switch
            id="sms"
            checked={isSmsEnabled}
            onCheckedChange={(checked) => setIsSmsEnabled(checked)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="crm">Enable CRM</Label>
          <Switch
            id="crm"
            checked={isCrmEnabled}
            onCheckedChange={(checked) => setIsCrmEnabled(checked)}
          />
        </div>
        <div>
          <Label htmlFor="defaultProvider">Default Provider</Label>
          <Select value={defaultProvider} onValueChange={setDefaultProvider}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="crm">CRM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <div className="p-6 pt-0">
        <Button onClick={handleSettingsUpdate}>Update Settings</Button>
      </div>
    </Card>
  );
}
