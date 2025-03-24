
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, Check, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Provider = {
  id: string;
  provider_type: 'email' | 'phone';
  provider_name: string;
  api_key: string;
  api_secret?: string;
  account_id?: string;
  is_active: boolean;
};

type CompanySettings = {
  id: string;
  default_email_provider?: string | null;
  default_phone_provider?: string | null;
};

const CommunicationSettings: React.FC<{ company: any; onUpdate: (updates: any) => Promise<void> }> = ({ 
  company,
  onUpdate
}) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("providers");
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    id: company.id,
    default_email_provider: company.default_email_provider,
    default_phone_provider: company.default_phone_provider
  });
  const { toast } = useToast();

  // New provider form state
  const [newProvider, setNewProvider] = useState<Partial<Provider>>({
    provider_type: 'phone',
    provider_name: '',
    api_key: '',
    api_secret: '',
    account_id: '',
    is_active: true
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_integrations_secure')
        .select('*')
        .eq('company_id', company.id)
        .order('provider_type', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch communication providers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewProviderChange = (field: string, value: string | boolean) => {
    setNewProvider(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveNewProvider = async () => {
    if (!newProvider.provider_name || !newProvider.api_key) {
      toast({
        title: "Validation Error",
        description: "Provider name and API key are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('company_integrations')
        .insert({
          company_id: company.id,
          provider_type: newProvider.provider_type,
          provider_name: newProvider.provider_name,
          api_key: newProvider.api_key,
          api_secret: newProvider.api_secret,
          account_id: newProvider.account_id,
          is_active: newProvider.is_active
        })
        .select();

      if (error) {
        throw error;
      }

      // Reset the form
      setNewProvider({
        provider_type: 'phone',
        provider_name: '',
        api_key: '',
        api_secret: '',
        account_id: '',
        is_active: true
      });

      toast({
        title: "Success",
        description: "Provider added successfully",
      });

      // Refresh providers list
      fetchProviders();
    } catch (error) {
      console.error('Error adding provider:', error);
      toast({
        title: "Error",
        description: "Failed to add provider",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDefaultProvider = async (type: 'email' | 'phone', providerId: string | null) => {
    try {
      const updates = type === 'email' 
        ? { default_email_provider: providerId } 
        : { default_phone_provider: providerId };
        
      await onUpdate(updates);
      
      setCompanySettings(prev => ({
        ...prev,
        ...(type === 'email' 
          ? { default_email_provider: providerId } 
          : { default_phone_provider: providerId })
      }));
      
      toast({
        title: "Success",
        description: `Default ${type} provider updated`,
      });
    } catch (error) {
      console.error(`Error updating default ${type} provider:`, error);
      toast({
        title: "Error",
        description: `Failed to update default ${type} provider`,
        variant: "destructive",
      });
    }
  };

  const toggleProviderStatus = async (providerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('company_integrations')
        .update({ is_active: !currentStatus })
        .eq('id', providerId);

      if (error) {
        throw error;
      }

      // Update local state
      setProviders(providers.map(provider => 
        provider.id === providerId 
          ? { ...provider, is_active: !currentStatus } 
          : provider
      ));

      toast({
        title: "Success",
        description: `Provider ${currentStatus ? 'deactivated' : 'activated'}`,
      });
    } catch (error) {
      console.error('Error toggling provider status:', error);
      toast({
        title: "Error",
        description: "Failed to update provider status",
        variant: "destructive",
      });
    }
  };

  const deleteProvider = async (providerId: string) => {
    // Check if this is a default provider
    if (
      providerId === companySettings.default_email_provider || 
      providerId === companySettings.default_phone_provider
    ) {
      toast({
        title: "Cannot Delete",
        description: "This provider is set as a default. Please change the default provider first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('company_integrations')
        .delete()
        .eq('id', providerId);

      if (error) {
        throw error;
      }

      // Update local state
      setProviders(providers.filter(provider => provider.id !== providerId));

      toast({
        title: "Success",
        description: "Provider deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast({
        title: "Error",
        description: "Failed to delete provider",
        variant: "destructive",
      });
    }
  };

  const phoneProviders = providers.filter(p => p.provider_type === 'phone');
  const emailProviders = providers.filter(p => p.provider_type === 'email');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Communication Settings</CardTitle>
          <CardDescription>
            Configure your communication providers and default settings
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="providers">Providers</TabsTrigger>
              <TabsTrigger value="defaults">Default Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="providers" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Provider</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="provider_type">Provider Type</Label>
                      <Select 
                        value={newProvider.provider_type} 
                        onValueChange={(value) => handleNewProviderChange('provider_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone">Phone/SMS</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider_name">Provider Name</Label>
                      <Input 
                        id="provider_name" 
                        placeholder="e.g., Twilio, SendGrid" 
                        value={newProvider.provider_name}
                        onChange={(e) => handleNewProviderChange('provider_name', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api_key">API Key</Label>
                      <Input 
                        id="api_key" 
                        type="password" 
                        placeholder="API Key" 
                        value={newProvider.api_key}
                        onChange={(e) => handleNewProviderChange('api_key', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api_secret">API Secret (Optional)</Label>
                      <Input 
                        id="api_secret" 
                        type="password" 
                        placeholder="API Secret" 
                        value={newProvider.api_secret}
                        onChange={(e) => handleNewProviderChange('api_secret', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account_id">Account ID (Optional)</Label>
                      <Input 
                        id="account_id" 
                        placeholder="Account ID" 
                        value={newProvider.account_id}
                        onChange={(e) => handleNewProviderChange('account_id', e.target.value)}
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-8">
                      <Switch 
                        id="is_active" 
                        checked={newProvider.is_active}
                        onCheckedChange={(checked) => handleNewProviderChange('is_active', checked)}
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                  </div>

                  <Button onClick={saveNewProvider} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" /> Add Provider
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Phone/SMS Providers</h3>
                  {phoneProviders.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      No phone providers configured
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {phoneProviders.map(provider => (
                        <Card key={provider.id}>
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium">{provider.provider_name}</h4>
                                <p className="text-sm text-gray-500">
                                  {provider.is_active ? 'Active' : 'Inactive'} • 
                                  {companySettings.default_phone_provider === provider.id && 
                                    <span className="text-green-600 ml-1 flex items-center">
                                      <Check className="h-3 w-3 mr-1" /> Default
                                    </span>
                                  }
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => toggleProviderStatus(provider.id, provider.is_active)}
                                >
                                  {provider.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleUpdateDefaultProvider('phone', provider.id)}
                                  disabled={companySettings.default_phone_provider === provider.id}
                                >
                                  Set as Default
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => deleteProvider(provider.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Email Providers</h3>
                  {emailProviders.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      No email providers configured
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {emailProviders.map(provider => (
                        <Card key={provider.id}>
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium">{provider.provider_name}</h4>
                                <p className="text-sm text-gray-500">
                                  {provider.is_active ? 'Active' : 'Inactive'} • 
                                  {companySettings.default_email_provider === provider.id && 
                                    <span className="text-green-600 ml-1 flex items-center">
                                      <Check className="h-3 w-3 mr-1" /> Default
                                    </span>
                                  }
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => toggleProviderStatus(provider.id, provider.is_active)}
                                >
                                  {provider.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleUpdateDefaultProvider('email', provider.id)}
                                  disabled={companySettings.default_email_provider === provider.id}
                                >
                                  Set as Default
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => deleteProvider(provider.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="defaults" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Default Communication Settings</CardTitle>
                  <CardDescription>
                    Set your default communication providers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="default_phone_provider">Default Phone/SMS Provider</Label>
                      <Select 
                        value={companySettings.default_phone_provider || ''} 
                        onValueChange={(value) => handleUpdateDefaultProvider('phone', value || null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select default provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {phoneProviders
                            .filter(p => p.is_active)
                            .map(provider => (
                              <SelectItem key={provider.id} value={provider.id}>
                                {provider.provider_name}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="default_email_provider">Default Email Provider</Label>
                      <Select 
                        value={companySettings.default_email_provider || ''} 
                        onValueChange={(value) => handleUpdateDefaultProvider('email', value || null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select default provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {emailProviders
                            .filter(p => p.is_active)
                            .map(provider => (
                              <SelectItem key={provider.id} value={provider.id}>
                                {provider.provider_name}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>

                    {(!companySettings.default_phone_provider && !companySettings.default_email_provider) && (
                      <div className="flex items-center p-3 text-sm bg-amber-50 border border-amber-200 rounded-md">
                        <AlertCircle className="h-4 w-4 text-amber-500 mr-2 flex-shrink-0" />
                        <p className="text-amber-800">
                          No default communication providers are set. Set defaults to ensure communications work properly.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunicationSettings;
