
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TokenUsageChart } from './TokenUsageChart';
import { MetricsCards } from './MetricsCards';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const ObservabilityTab = () => {
  const { data: dailyMetrics, isLoading: loadingDaily } = useQuery({
    queryKey: ['daily-llm-costs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_daily_llm_costs')
        .select('*')
        .order('day', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: overallMetrics, isLoading: loadingOverall } = useQuery({
    queryKey: ['prompt-runs-metrics'],
    queryFn: async () => {
      const { data: runs, error } = await supabase
        .from('prompt_runs')
        .select('prompt_tokens, completion_tokens, usd_cost, status');
      
      if (error) throw error;

      const totalRuns = runs.length;
      const totalTokens = runs.reduce((acc, run) => 
        acc + (run.prompt_tokens || 0) + (run.completion_tokens || 0), 0);
      const totalCost = runs.reduce((acc, run) => acc + (run.usd_cost || 0), 0);
      const successfulRuns = runs.filter(run => run.status === 'COMPLETED').length;

      return {
        totalPromptRuns: totalRuns,
        avgTokensPerRun: totalRuns ? totalTokens / totalRuns : 0,
        totalCost: totalCost,
        successRate: totalRuns ? successfulRuns / totalRuns : 0
      };
    }
  });

  if (loadingDaily || loadingOverall) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This dashboard shows metrics for AI usage and costs across your organization.
        </AlertDescription>
      </Alert>

      {overallMetrics && <MetricsCards metrics={overallMetrics} />}
      
      {dailyMetrics && dailyMetrics.length > 0 && (
        <TokenUsageChart data={dailyMetrics} />
      )}
    </div>
  );
};
