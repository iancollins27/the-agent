import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const JobProgressTestPanel: React.FC = () => {
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch companies with JobProgress integrations
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-jobprogress'],
    queryFn: async () => {
      console.log('Fetching JobProgress companies...');
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
        .eq('provider_name', 'JobProgress')
        .eq('is_active', true);
      
      console.log('JobProgress companies query result:', { data, error });
      
      if (error) {
        console.error('Error fetching JobProgress companies:', error);
        throw error;
      }
      return data;
    }
  });

  console.log('Companies data:', companies);

  const testDataFetch = async (operation: string) => {
    if (!selectedCompany || !projectId) {
      toast({
        title: "Missing Information",
        description: "Please select a company and enter a project ID",
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
          project_id: projectId,
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

  const testDataPush = async (operationType: string, resourceType: string) => {
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
      const testData = {
        project: { name: "Test Project", address: "123 Test St" },
        task: { title: "Test Task", description: "Test task description" },
        note: { content: "Test note content" }
      };

      const { data, error } = await supabase.functions.invoke('data-push', {
        body: {
          companyId: selectedCompany,
          resourceType,
          operationType,
          data: testData[resourceType as keyof typeof testData]
        }
      });

      if (error) throw error;

      setTestResults({
        operation: `${operationType} ${resourceType}`,
        success: true,
        data,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Test Successful",
        description: `${operationType} ${resourceType} operation completed successfully`
      });
    } catch (error: any) {
      console.error('Test error:', error);
      setTestResults({
        operation: `${operationType} ${resourceType}`,
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
          <CardTitle>JobProgress Integration Testing</CardTitle>
          <CardDescription>
            Test JobProgress API integration including data fetching and pushing operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger>
                <SelectValue placeholder={companiesLoading ? "Loading companies..." : companies?.length === 0 ? "No JobProgress integrations found" : "Select a company"} />
              </SelectTrigger>
              <SelectContent>
                {companies?.map((integration) => (
                  <SelectItem key={integration.id} value={integration.company_id}>
                    {integration.companies?.name || 'Unknown Company'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {companies?.length === 0 && !companiesLoading && (
              <p className="text-sm text-muted-foreground">
                No active JobProgress integrations found. Please configure a JobProgress integration in company settings first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectId">Project ID (for data fetch tests)</Label>
            <Input
              id="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Enter JobProgress project ID"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="fetch" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fetch">Data Fetch</TabsTrigger>
          <TabsTrigger value="push">Data Push</TabsTrigger>
          <TabsTrigger value="connection">Connection Test</TabsTrigger>
        </TabsList>

        <TabsContent value="fetch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Fetch Operations</CardTitle>
              <CardDescription>Test fetching data from JobProgress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button 
                  onClick={() => testDataFetch('project')}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Project'}
                </Button>
                <Button 
                  onClick={() => testDataFetch('tasks')}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Tasks'}
                </Button>
                <Button 
                  onClick={() => testDataFetch('notes')}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Notes'}
                </Button>
                <Button 
                  onClick={() => testDataFetch('contacts')}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Contacts'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="push" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Push Operations</CardTitle>
              <CardDescription>Test creating/updating data in JobProgress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Project Operations</h4>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => testDataPush('create', 'project')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      Create Project
                    </Button>
                    <Button 
                      onClick={() => testDataPush('update', 'project')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      Update Project
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Task Operations</h4>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => testDataPush('create', 'task')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      Create Task
                    </Button>
                    <Button 
                      onClick={() => testDataPush('update', 'task')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      Update Task
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Note Operations</h4>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => testDataPush('create', 'note')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      Create Note
                    </Button>
                    <Button 
                      onClick={() => testDataPush('update', 'note')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      Update Note
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connection Test</CardTitle>
              <CardDescription>Test connection to JobProgress API</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => testDataFetch('connection')}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Test Connection
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

export default JobProgressTestPanel;
