
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertCircle, Check, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

type ProviderType = 'email' | 'phone';

type Provider = {
  id: string;
  provider_type: ProviderType;
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

// Define form validation schema
const integrationFormSchema = z.object({
  provider_type: z.enum(['email', 'phone']),
  provider_name: z.string().min(1, "Provider name is required"),
  api_key: z.string().min(1, "API key is required"),
  api_secret: z.string().optional(),
  account_id: z.string().optional(),
  is_active: z.boolean().default(true),
});

type IntegrationFormValues = z.infer<typeof integrationFormSchema>;

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

  // Initialize react-hook-form
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      provider_type: 'phone',
      provider_name: '',
      api_key: '',
      api_secret: '',
      account_id: '',
      is_active: true
    },
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

      // Map and validate the provider_type from database to the expected union type
      const validProviders = data?.map(provider => ({
        ...provider,
        provider_type: validateProviderType(provider.provider_type)
      })) || [];
      
      setProviders(validProviders as Provider[]);
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
  
  // Helper function to validate provider_type is one of the expected values
  const validateProviderType = (type: string | null): ProviderType => {
    if (type === 'email' || type === 'phone') {
      return type;
    }
    // Default to 'phone' if type is invalid
    return 'phone';
  };

  const onSubmit = async (values: IntegrationFormValues) => {
    try {
      console.log('Submitting form with values:', values);
      
      // Ensure values are properly formatted for database
      const formattedValues = {
        company_id: company.id,
        provider_type: values.provider_type,
        provider_name: values.provider_name,
        api_key: values.api_key,
        api_secret: values.api_secret || null,
        account_id: values.account_id || null,
        is_active: values.is_active
      };
      
      console.log('Formatted values:', formattedValues);
      
      // Use the edge function to add the integration
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/manage-integrations/add`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.supabaseKey}`
          },
          body: JSON.stringify(formattedValues)
        }
      );
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to add integration');
      }

      toast({
        title: "Success",
        description: "Integration added successfully",
      });

      // Reset the form
      form.reset({
        provider_type: 'phone',
        provider_name: '',
        api_key: '',
        api_secret: '',
        account_id: '',
        is_active: true
      });

      // Refresh providers list
      fetchProviders();
    } catch (error: any) {
      console.error('Error adding integration:', error);
      let errorMessage = "Failed to add integration";
      
      // Extract more detailed error message if available
      if (error.message) {
        errorMessage += `: ${error.message}`;
      } else if (error.details) {
        errorMessage += `: ${error.details}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUpdateDefaultProvider = async (type: 'email' | 'phone', providerId: string | null) => {
    try {
      // Use the edge function to update the default provider
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/manage-integrations/update-default`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.supabaseKey}`
          },
          body: JSON.stringify({
            companyId: company.id,
            type,
            providerId
          })
        }
      );
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to update default ${type} provider`);
      }
      
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
      // Use the edge function to toggle provider status
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/manage-integrations/toggle-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.supabaseKey}`
          },
          body: JSON.stringify({
            integrationId: providerId,
            isActive: currentStatus
          })
        }
      );
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update provider status');
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
      // Use the edge function to delete the provider
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/manage-integrations/delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.supabaseKey}`
          },
          body: JSON.stringify({
            integrationId: providerId
          })
        }
      );
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete provider');
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
              <TabsTrigger value="add-integration">Add Integration</TabsTrigger>
              <TabsTrigger value="defaults">Default Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="providers" className="space-y-6">
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

            <TabsContent value="add-integration">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Integration</CardTitle>
                  <CardDescription>
                    Configure a new communication provider
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="provider_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Provider Type</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="phone">Phone/SMS</SelectItem>
                                  <SelectItem value="email">Email</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="provider_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Provider Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Twilio, SendGrid" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="api_key"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="API Key" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="api_secret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Secret (Optional)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="API Secret" 
                                  {...field} 
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="account_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account ID (Optional)</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Account ID" 
                                  {...field} 
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="is_active"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-8">
                              <FormControl>
                                <Switch 
                                  checked={field.value} 
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel>Active</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button type="submit" className="mt-4">
                        <Plus className="mr-2 h-4 w-4" /> Add Integration
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
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
