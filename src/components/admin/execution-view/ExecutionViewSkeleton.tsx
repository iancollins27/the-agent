
import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

const ExecutionViewSkeleton: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto my-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-5 w-48" />
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-20 w-full" />
              ))}
            </div>
            
            <div className="pt-4 space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionViewSkeleton;
