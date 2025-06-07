
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ZohoTestPanel: React.FC = () => {
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [dealId, setDealId] = useState<string>("");
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch companies with Zoho integrations
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-zoho'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_integrations')
        .select(`
          id,
          company_id,
          provider_name,
          is_active,
          companies (
            id,
            name
          )
        `)
        .eq('provider_name', 'Zoho')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    }
  });

  const testZohoOperation = async (operation: string) => {
    if (!selectedCompany) {
      toast({
        title: "Missing Information",
        description: "Please select a company",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-fetch', {
        body: {
          companyId: selectedCompany,
          resourceType: operation,
          deal_id: dealId || undefined,
          include_raw: true
        }
      });

      if (error) throw error;

      setTestResults({
        operation,
        success: true,
        data,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Test Successful",
        description: `${operation} operation completed successfully`
      });
    } catch (error: any) {
      console.error('Test error:', error);
      setTestResults({
        operation,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zoho Integration Testing</CardTitle>
          <CardDescription>
            Test Zoho CRM API integration including data fetching and pushing operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger>
                <SelectValue placeholder={companiesLoading ? "Loading companies..." : "Select a company"} />
              </SelectTrigger>
              <SelectContent>
                {companies?.map((integration) => (
                  <SelectItem key={integration.id} value={integration.company_id}>
                    {integration.companies?.name || 'Unknown Company'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dealId">Deal ID (optional)</Label>
            <Input
              id="dealId"
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              placeholder="Enter Zoho deal ID"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zoho Operations</CardTitle>
          <CardDescription>Test various Zoho CRM operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => testZohoOperation('deals')}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Deals'}
            </Button>
            <Button 
              onClick={() => testZohoOperation('contacts')}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Contacts'}
            </Button>
            <Button 
              onClick={() => testZohoOperation('notes')}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Notes'}
            </Button>
            <Button 
              onClick={() => testZohoOperation('tasks')}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Tasks'}
            </Button>
            <Button 
              onClick={() => testZohoOperation('activities')}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Activities'}
            </Button>
            <Button 
              onClick={() => testZohoOperation('connection')}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test Connection'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              {testResults.operation} - {testResults.timestamp}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testResults.success ? (
              <Alert>
                <AlertDescription>
                  Test completed successfully!
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  Test failed: {testResults.error}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="mt-4">
              <Label>Response Data:</Label>
              <Textarea
                value={JSON.stringify(testResults.data || testResults.error, null, 2)}
                readOnly
                className="mt-2 min-h-[200px] font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ZohoTestPanel;
