
import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

const ExecutionsListSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <Card key={item} className="w-full">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mt-2" />
          </CardContent>
          <CardFooter className="flex justify-between pt-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-28" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default ExecutionsListSkeleton;
