
import React from 'react';
import JobProgressTestPanel from './JobProgressTestPanel';

const IntegrationsTestTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Integration Testing</h2>
        <p className="text-gray-600">
          Test connectivity and data operations for CRM integrations
        </p>
      </div>
      
      <JobProgressTestPanel />
    </div>
  );
};

export default IntegrationsTestTab;
