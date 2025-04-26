
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

interface TokenUsageData {
  day: string;
  total_tokens: number;
  total_usd: number;
}

export const TokenUsageChart = ({ data }: { data: TokenUsageData[] }) => {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Daily Token Usage & Costs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="day" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="total_tokens" fill="#8884d8" name="Total Tokens" />
              <Bar yAxisId="right" dataKey="total_usd" fill="#82ca9d" name="Cost (USD)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
