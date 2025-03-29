
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/providers/SettingsProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CommunicationProvider {
  id: string;
  provider_name: string;
  provider_type: string;
}

const CommunicationSettings: React.FC = () => {
  const { companySettings, updateCompanySettings, isLoading: settingsLoading } = useSettings();
  const { toast } = useToast();
  const [emailProviders, setEmailProviders] = useState<CommunicationProvider[]>([]);
  const [phoneProviders, setPhoneProviders] = useState<CommunicationProvider[]>([]);
  const [selectedEmailProvider, setSelectedEmailProvider] = useState<string>('');
  const [selectedPhoneProvider, setSelectedPhoneProvider] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all communication providers for this company
        const { data, error } = await supabase
          .from('company_integrations')
          .select('id, provider_name, provider_type')
          .eq('company_id', companySettings?.id || '')
          .eq('is_active', true);
          
        if (error) {
          throw error;
        }
        
        if (data) {
          console.log('Fetched providers:', data);
          const emailProvs = data.filter(p => p.provider_type === 'email');
          const phoneProvs = data.filter(p => p.provider_type === 'phone' || p.provider_type === 'sms');
          
          setEmailProviders(emailProvs);
          setPhoneProviders(phoneProvs);
        }
      } catch (error) {
        console.error('Error fetching providers:', error);
        toast({
          title: "Error",
          description: "Failed to load communication providers",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (companySettings?.id) {
      fetchProviders();
      
      // Set selected providers from company settings
      setSelectedEmailProvider(companySettings.default_email_provider || '');
      setSelectedPhoneProvider(companySettings.default_phone_provider || '');
    }
  }, [companySettings?.id, toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCompanySettings({
        default_email_provider: selectedEmailProvider,
        default_phone_provider: selectedPhoneProvider
      });
      
      toast({
        title: "Success",
        description: "Communication settings updated successfully",
      });
    } catch (error) {
      console.error('Error saving communication settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestCommunication = async () => {
    if (!companySettings?.id) {
      toast({
        title: "Error",
        description: "No company selected",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      console.log('Testing communication with provider:', selectedPhoneProvider);
      
      const { data, error } = await supabase.functions.invoke('send-communication', {
        body: {
          messageContent: "This is a test message from the settings page",
          recipient: {
            name: "Test User",
            phone: "1234567890" // Use a valid test number in production
          },
          channel: "sms",
          providerId: selectedPhoneProvider,
          companyId: companySettings.id,
          isTest: true
        }
      });
      
      if (error) {
        console.error('Error invoking send-communication function:', error);
        throw new Error(error.message);
      }
      
      console.log('Communication test response:', data);
      
      toast({
        title: "Test Successful",
        description: "Communication test was successful. Check the logs for details.",
      });
    } catch (error: any) {
      console.error('Error testing communication:', error);
      toast({
        title: "Test Failed",
        description: error.message || "Communication test failed",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (settingsLoading || isLoading) {
    return <div className="p-4">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Communication Providers</CardTitle>
          <CardDescription>
            Configure default providers for different communication channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-provider">Default Email Provider</Label>
            <Select 
              value={selectedEmailProvider} 
              onValueChange={setSelectedEmailProvider}
            >
              <SelectTrigger id="email-provider">
                <SelectValue placeholder="Select an email provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {emailProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.provider_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone-provider">Default SMS/Phone Provider</Label>
            <Select 
              value={selectedPhoneProvider} 
              onValueChange={setSelectedPhoneProvider}
            >
              <SelectTrigger id="phone-provider">
                <SelectValue placeholder="Select a phone/SMS provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {phoneProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.provider_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="mt-4"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            
            <Button 
              onClick={handleTestCommunication} 
              disabled={isTesting || (!selectedPhoneProvider && !selectedEmailProvider)}
              variant="outline"
              className="mt-4"
            >
              {isTesting ? "Testing..." : "Test Communication"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Provider</CardTitle>
          <CardDescription>
            Manage your communication integration providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To add new communication providers, please contact your system administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunicationSettings;
