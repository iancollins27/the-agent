
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
}

const MetricCard = ({ title, value, description }: MetricCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Database className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

interface MetricsData {
  totalPromptRuns: number;
  avgTokensPerRun: number;
  totalCost: number;
  successRate: number;
}

export const MetricsCards = ({ metrics }: { metrics: MetricsData }) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Prompt Runs"
        value={metrics.totalPromptRuns}
      />
      <MetricCard
        title="Avg Tokens/Run"
        value={Math.round(metrics.avgTokensPerRun)}
      />
      <MetricCard
        title="Total Cost (USD)"
        value={`$${metrics.totalCost.toFixed(2)}`}
      />
      <MetricCard
        title="Success Rate"
        value={`${(metrics.successRate * 100).toFixed(1)}%`}
      />
    </div>
  );
};
