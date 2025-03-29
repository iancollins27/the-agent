import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from "@/components/ui/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, PlusIcon, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from '@/integrations/supabase/UserProvider';

// Define the schema for the integration form
const integrationSchema = z.object({
  providerType: z.string().min(1, { message: "Provider type is required." }),
  providerName: z.string().min(1, { message: "Provider name is required." }),
  apiKey: z.string().min(1, { message: "API Key is required." }),
  apiSecret: z.string().optional(),
  accountId: z.string().optional(),
});

type IntegrationFormValues = z.infer<typeof integrationSchema>;

const CommunicationSettings = () => {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const { user } = useUser();
  const defaultCompanyId = user?.user_metadata?.companyId;

  // Form setup using react-hook-form
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      providerType: "",
      providerName: "",
      apiKey: "",
      apiSecret: "",
      accountId: "",
    },
  });

  // Fetch integrations on component mount
  useEffect(() => {
    fetchIntegrations();
    fetchCompanyData();
    fetchCompanies();
  }, []);

  // Fetch integrations from Supabase
  const fetchIntegrations = async () => {
    try {
      let query = supabase
        .from('company_integrations')
        .select('*')
        .eq('company_id', selectedCompany || defaultCompanyId);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching integrations:', error);
        toast({
          title: 'Error',
          description: `Failed to fetch integrations: ${error.message}`,
          variant: 'destructive',
        });
      } else {
        setIntegrations(data || []);
      }
    } catch (err: any) {
      console.error('Exception fetching integrations:', err);
      toast({
        title: 'Error',
        description: `Failed to fetch integrations: ${err.message}`,
        variant: 'destructive',
      });
    }
  };

  // Fetch company data from Supabase
  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', selectedCompany || defaultCompanyId)
        .single();

      if (error) {
        console.error('Error fetching company data:', error);
        toast({
          title: 'Error',
          description: `Failed to fetch company data: ${error.message}`,
          variant: 'destructive',
        });
      } else {
        setCompanyData(data);
      }
    } catch (err: any) {
      console.error('Exception fetching company data:', err);
      toast({
        title: 'Error',
        description: `Failed to fetch company data: ${err.message}`,
        variant: 'destructive',
      });
    }
  };

  // Fetch companies from Supabase
  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name');

      if (error) {
        console.error('Error fetching companies:', error);
        toast({
          title: 'Error',
          description: `Failed to fetch companies: ${error.message}`,
          variant: 'destructive',
        });
      } else {
        setCompanies(data || []);
      }
    } catch (err: any) {
      console.error('Exception fetching companies:', err);
      toast({
        title: 'Error',
        description: `Failed to fetch companies: ${err.message}`,
        variant: 'destructive',
      });
    }
  };

  // Function to add a new integration using the edge function
  const addIntegration = async (integrationData: any) => {
    try {
      setIsSubmitting(true);
      
      // Call the manage-integrations edge function
      const { data, error } = await supabase.functions.invoke('manage-integrations', {
        body: {
          company_id: selectedCompany || defaultCompanyId,
          provider_type: integrationData.providerType,
          provider_name: integrationData.providerName,
          api_key: integrationData.apiKey,
          api_secret: integrationData.apiSecret,
          account_id: integrationData.accountId,
          is_active: true
        }
      });
      
      if (error) {
        console.error('Error adding integration:', error);
        toast({
          title: 'Error',
          description: `Failed to add integration: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }
      
      if (!data.success) {
        console.error('Failed to add integration:', data.error);
        toast({
          title: 'Error',
          description: `Failed to add integration: ${data.error}`,
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: 'Success',
        description: 'Integration added successfully',
      });
      
      // Reset form and refresh integrations
      form.reset();
      fetchIntegrations();
    } catch (err: any) {
      console.error('Exception adding integration:', err);
      toast({
        title: 'Error',
        description: `Failed to add integration: ${err.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to delete an integration
  const deleteIntegration = async (integrationId: string) => {
    try {
      setIsDeleting(true);
      
      // Call the manage-integrations edge function
      const { data, error } = await supabase.functions.invoke('manage-integrations', {
        body: {
          integrationId
        }
      });
      
      if (error) {
        console.error('Error deleting integration:', error);
        toast({
          title: 'Error',
          description: `Failed to delete integration: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }
      
      if (!data.success) {
        console.error('Failed to delete integration:', data.error);
        toast({
          title: 'Error',
          description: `Failed to delete integration: ${data.error}`,
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: 'Success',
        description: 'Integration deleted successfully',
      });
      
      // Refresh integrations
      fetchIntegrations();
    } catch (err: any) {
      console.error('Exception deleting integration:', err);
      toast({
        title: 'Error',
        description: `Failed to delete integration: ${err.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to toggle integration status
  const toggleIntegrationStatus = async (integrationId: string, isActive: boolean) => {
    try {
      // Call the manage-integrations edge function
      const { data, error } = await supabase.functions.invoke('manage-integrations', {
        body: {
          integrationId,
          isActive
        }
      });
      
      if (error) {
        console.error('Error toggling integration status:', error);
        toast({
          title: 'Error',
          description: `Failed to update integration status: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }
      
      if (!data.success) {
        console.error('Failed to toggle integration status:', data.error);
        toast({
          title: 'Error',
          description: `Failed to update integration status: ${data.error}`,
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: 'Success',
        description: 'Integration status updated successfully',
      });
      
      // Refresh integrations
      fetchIntegrations();
    } catch (err: any) {
      console.error('Exception toggling integration status:', err);
      toast({
        title: 'Error',
        description: `Failed to update integration status: ${err.message}`,
        variant: 'destructive',
      });
    }
  };

  // Function to update default provider
  const updateDefaultProvider = async (providerId: string, type: 'email' | 'phone') => {
    try {
      // Call the manage-integrations edge function
      const { data, error } = await supabase.functions.invoke('manage-integrations', {
        body: {
          companyId: selectedCompany || defaultCompanyId,
          type,
          providerId: providerId === 'none' ? null : providerId
        }
      });
      
      if (error) {
        console.error('Error updating default provider:', error);
        toast({
          title: 'Error',
          description: `Failed to update default provider: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }
      
      if (!data.success) {
        console.error('Failed to update default provider:', data.error);
        toast({
          title: 'Error',
          description: `Failed to update default provider: ${data.error}`,
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: 'Success',
        description: `Default ${type} provider updated successfully`,
      });
      
      // Refresh company data
      fetchCompanyData();
    } catch (err: any) {
      console.error('Exception updating default provider:', err);
      toast({
        title: 'Error',
        description: `Failed to update default provider: ${err.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-5">Communication Settings</h1>

      {/* Company Selection */}
      {companies.length > 0 && (
        <div className="mb-5">
          <Label htmlFor="company">Select Company</Label>
          <Select value={selectedCompany || defaultCompanyId || ''} onValueChange={setSelectedCompany}>
            <SelectTrigger id="company">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Default Provider Settings */}
      {companyData && (
        <div className="mb-5">
          <h2 className="text-xl font-semibold mb-3">Default Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="defaultEmailProvider">Default Email Provider</Label>
              <Select
                value={companyData.default_email_provider || 'none'}
                onValueChange={(value) => updateDefaultProvider(value, 'email')}
              >
                <SelectTrigger id="defaultEmailProvider">
                  <SelectValue placeholder="Select email provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {integrations
                    .filter((integration) => integration.provider_type === 'email')
                    .map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.provider_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="defaultPhoneProvider">Default Phone Provider</Label>
              <Select
                value={companyData.default_phone_provider || 'none'}
                onValueChange={(value) => updateDefaultProvider(value, 'phone')}
              >
                <SelectTrigger id="defaultPhoneProvider">
                  <SelectValue placeholder="Select phone provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {integrations
                    .filter((integration) => integration.provider_type === 'phone')
                    .map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.provider_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Integration Form */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold mb-3">Add New Integration</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(addIntegration)} className="space-y-4">
            <FormField
              control={form.control}
              name="providerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Type</FormLabel>
                  <Select {...field}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="providerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Provider Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input placeholder="API Key" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Secret (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="API Secret" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account ID (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Account ID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Add Integration"}
              <PlusIcon className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </Form>
      </div>

      {/* Integrations Table */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Current Integrations</h2>
        <Table>
          <TableCaption>A list of your current communication integrations.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {integrations.map((integration) => (
              <TableRow key={integration.id}>
                <TableCell>{integration.provider_type}</TableCell>
                <TableCell>{integration.provider_name}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Switch
                      id={`integration-status-${integration.id}`}
                      checked={integration.is_active}
                      onCheckedChange={(checked) => toggleIntegrationStatus(integration.id, !checked)}
                    />
                    <Label htmlFor={`integration-status-${integration.id}`} className="ml-2">
                      {integration.is_active ? 'Active' : 'Inactive'}
                    </Label>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => deleteIntegration(integration.id)} disabled={isDeleting}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {integrations.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">No integrations found.</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>
                Total {integrations.length} integration(s)
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
};

export default CommunicationSettings;
