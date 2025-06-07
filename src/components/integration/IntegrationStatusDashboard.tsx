
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const IntegrationStatusDashboard: React.FC = () => {
  // Fetch integration status
  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ['integration-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_integrations')
        .select(`
          id,
          provider_name,
          provider_type,
          is_active,
          created_at,
          updated_at,
          companies (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch recent integration jobs
  const { data: recentJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['recent-integration-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_job_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  const getStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'destructive';
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      case 'retry': return 'outline';
      default: return 'secondary';
    }
  };

  if (integrationsLoading || jobsLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeIntegrations = integrations?.filter(i => i.is_active) || [];
  const inactiveIntegrations = integrations?.filter(i => !i.is_active) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Integration Overview</CardTitle>
          <CardDescription>
            Current status of all integrations across companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{activeIntegrations.length}</div>
              <div className="text-sm text-green-600">Active Integrations</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{inactiveIntegrations.length}</div>
              <div className="text-sm text-red-600">Inactive Integrations</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{recentJobs?.length || 0}</div>
              <div className="text-sm text-blue-600">Recent Jobs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Integrations</CardTitle>
          <CardDescription>
            Currently active integrations by company and provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeIntegrations.length === 0 ? (
            <Alert>
              <AlertDescription>
                No active integrations found. Configure integrations in company settings.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeIntegrations.map((integration) => (
                <div key={integration.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{integration.companies?.name}</h4>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>Provider: {integration.provider_name}</div>
                    <div>Type: {integration.provider_type}</div>
                    <div>Created: {new Date(integration.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Integration Jobs</CardTitle>
          <CardDescription>
            Latest integration jobs and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentJobs && recentJobs.length > 0 ? (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {job.operation_type} {job.resource_type}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(job.created_at).toLocaleString()}
                    </div>
                    {job.processed_at && (
                      <div className="text-sm text-muted-foreground">
                        Processed: {new Date(job.processed_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant={getStatusColor(job.status, true)}>
                      {job.status}
                    </Badge>
                    {job.retry_count > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Retries: {job.retry_count}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No recent integration jobs found.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationStatusDashboard;
