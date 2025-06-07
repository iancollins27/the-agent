
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle, XCircle, TestTube, Database, Edit3 } from "lucide-react";

const JobProgressTestPanel = () => {
  const [companyId, setCompanyId] = useState('');
  const [testJobId, setTestJobId] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingDataFetch, setIsTestingDataFetch] = useState(false);
  const [isTestingWrite, setIsTestingWrite] = useState(false);
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [dataFetchResult, setDataFetchResult] = useState<any>(null);
  const [writeTestResult, setWriteTestResult] = useState<any>(null);
  const { toast } = useToast();

  const testConnection = async () => {
    if (!companyId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a company ID",
        variant: "destructive",
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-jobprogress-connection', {
        body: {
          companyId: companyId.trim(),
          testJobId: testJobId.trim() || undefined
        }
      });

      if (error) {
        throw error;
      }

      setConnectionResult(data);
      
      if (data.success) {
        toast({
          title: "Connection Successful",
          description: "JobProgress API connection is working",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      setConnectionResult({
        success: false,
        error: error.message || 'Unknown error occurred'
      });
      toast({
        title: "Test Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testDataFetch = async () => {
    if (!companyId.trim() || !testJobId.trim()) {
      toast({
        title: "Error",
        description: "Please enter both company ID and job ID for data fetch test",
        variant: "destructive",
      });
      return;
    }

    setIsTestingDataFetch(true);
    setDataFetchResult(null);

    try {
      // First create a test project record with valid enum value
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          company_id: companyId.trim(),
          crm_id: testJobId.trim(),
          project_name: `Test Job ${testJobId}`,
          Project_status: 'Active' as const // Use proper enum value
        })
        .select()
        .single();

      if (projectError) {
        throw new Error(`Failed to create test project: ${projectError.message}`);
      }

      // Now test the data fetch with the project UUID
      const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
        body: {
          tool_name: 'data_fetch',
          args: {
            project_id: projectData.id,
            include_raw: true
          }
        }
      });

      if (error) {
        throw error;
      }

      setDataFetchResult(data);
      
      if (data.status === 'success') {
        toast({
          title: "Data Fetch Successful",
          description: "JobProgress data was fetched and mapped successfully",
        });
      } else {
        toast({
          title: "Data Fetch Failed",
          description: data.error,
          variant: "destructive",
        });
      }

      // Clean up test project
      await supabase
        .from('projects')
        .delete()
        .eq('id', projectData.id);

    } catch (error: any) {
      console.error('Data fetch test error:', error);
      setDataFetchResult({
        status: 'error',
        error: error.message || 'Unknown error occurred'
      });
      toast({
        title: "Test Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTestingDataFetch(false);
    }
  };

  const testWriteOperation = async () => {
    if (!companyId.trim() || !testJobId.trim()) {
      toast({
        title: "Error",
        description: "Please enter both company ID and job ID for write test",
        variant: "destructive",
      });
      return;
    }

    setIsTestingWrite(true);
    setWriteTestResult(null);

    try {
      // Test creating a note in JobProgress
      const testNoteData = {
        content: `Test note created at ${new Date().toISOString()}`,
        title: "Integration Test Note",
        project_id: testJobId.trim()
      };

      const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
        body: {
          tool_name: 'crm_data_write',
          args: {
            companyId: companyId.trim(),
            resourceType: 'note',
            operationType: 'create',
            data: testNoteData
          }
        }
      });

      if (error) {
        throw error;
      }

      setWriteTestResult(data);
      
      if (data.status === 'success') {
        toast({
          title: "Write Test Successful",
          description: "Successfully created a test note in JobProgress",
        });
      } else {
        toast({
          title: "Write Test Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Write test error:', error);
      setWriteTestResult({
        status: 'error',
        error: error.message || 'Unknown error occurred'
      });
      toast({
        title: "Test Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTestingWrite(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            JobProgress Integration Testing
          </CardTitle>
          <CardDescription>
            Test connectivity, data fetching, and write operations for JobProgress integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyId">Company ID</Label>
              <Input
                id="companyId"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="Enter company UUID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testJobId">JobProgress Job ID</Label>
              <Input
                id="testJobId"
                value={testJobId}
                onChange={(e) => setTestJobId(e.target.value)}
                placeholder="Enter JobProgress job ID"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={testConnection}
              disabled={isTestingConnection}
              className="flex items-center gap-2"
            >
              {isTestingConnection && <Loader2 className="h-4 w-4 animate-spin" />}
              <TestTube className="h-4 w-4" />
              Test Connection
            </Button>
            
            <Button 
              onClick={testDataFetch}
              disabled={isTestingDataFetch || !testJobId.trim()}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isTestingDataFetch && <Loader2 className="h-4 w-4 animate-spin" />}
              <Database className="h-4 w-4" />
              Test Data Fetch
            </Button>

            <Button 
              onClick={testWriteOperation}
              disabled={isTestingWrite || !testJobId.trim()}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isTestingWrite && <Loader2 className="h-4 w-4 animate-spin" />}
              <Edit3 className="h-4 w-4" />
              Test Write Operation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connection Test Results */}
      {connectionResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {connectionResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Connection Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={connectionResult.success ? "default" : "destructive"}>
              {connectionResult.success ? "Success" : "Failed"}
            </Badge>
            
            {connectionResult.success ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Integration Details</h4>
                  <div className="text-sm text-gray-600 mt-1">
                    <p>Provider: {connectionResult.integration?.provider_name}</p>
                    <p>Account ID: {connectionResult.integration?.account_id || 'Not set'}</p>
                    <p>Created: {new Date(connectionResult.integration?.created_at).toLocaleString()}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium">API Test Results</h4>
                  <Textarea
                    readOnly
                    value={JSON.stringify(connectionResult.apiTest, null, 2)}
                    className="text-xs font-mono"
                    rows={6}
                  />
                </div>
                
                {connectionResult.jobTest && (
                  <div>
                    <h4 className="font-medium">Job Test Results</h4>
                    <Textarea
                      readOnly
                      value={JSON.stringify(connectionResult.jobTest, null, 2)}
                      className="text-xs font-mono"
                      rows={8}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  <strong>Error:</strong> {connectionResult.error}
                  {connectionResult.details && (
                    <div className="mt-2">
                      <strong>Details:</strong> {connectionResult.details}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Fetch Test Results */}
      {dataFetchResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {dataFetchResult.status === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Data Fetch Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={dataFetchResult.status === 'success' ? "default" : "destructive"}>
              {dataFetchResult.status === 'success' ? "Success" : "Failed"}
            </Badge>
            
            {dataFetchResult.status === 'success' ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Fetched Data Summary</h4>
                  <div className="text-sm text-gray-600 mt-1">
                    <p>Provider: {dataFetchResult.provider}</p>
                    <p>Project: {dataFetchResult.project?.name || dataFetchResult.project?.project_name}</p>
                    <p>Contacts: {dataFetchResult.contacts?.length || 0}</p>
                    <p>Tasks: {dataFetchResult.tasks?.length || 0}</p>
                    <p>Notes: {dataFetchResult.notes?.length || 0}</p>
                    <p>Communications: {dataFetchResult.communications?.length || 0}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium">Full Response</h4>
                  <Textarea
                    readOnly
                    value={JSON.stringify(dataFetchResult, null, 2)}
                    className="text-xs font-mono"
                    rows={12}
                  />
                </div>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  <strong>Error:</strong> {dataFetchResult.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Write Operation Test Results */}
      {writeTestResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {writeTestResult.status === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Write Operation Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={writeTestResult.status === 'success' ? "default" : "destructive"}>
              {writeTestResult.status === 'success' ? "Success" : "Failed"}
            </Badge>
            
            {writeTestResult.status === 'success' ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Write Operation Summary</h4>
                  <div className="text-sm text-gray-600 mt-1">
                    <p>Operation: Create Note</p>
                    <p>Target: JobProgress Job {testJobId}</p>
                    <p>Status: Successfully created test note</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium">Full Response</h4>
                  <Textarea
                    readOnly
                    value={JSON.stringify(writeTestResult, null, 2)}
                    className="text-xs font-mono"
                    rows={8}
                  />
                </div>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  <strong>Error:</strong> {writeTestResult.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JobProgressTestPanel;
