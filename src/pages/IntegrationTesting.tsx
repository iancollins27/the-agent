
import React from 'react';
import UserMenu from '@/components/UserMenu';
import JobProgressTestPanel from '@/components/admin/JobProgressTestPanel';

const IntegrationTesting = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex justify-between items-center p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">Integration Testing</h1>
          <p className="text-muted-foreground">Test CRM integrations and data operations</p>
        </div>
        <UserMenu />
      </div>
      
      <div className="container mx-auto p-6">
        <JobProgressTestPanel />
      </div>
    </div>
  );
};

export default IntegrationTesting;
