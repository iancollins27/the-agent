import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ActionRecord } from './types';

interface TestResultsProps {
  actionId: string;
}

const TestResults: React.FC<TestResultsProps> = ({ actionId }) => {
  const [actionData, setActionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActionData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('action_records')
          .select('*')
          .eq('id', actionId)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        setActionData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActionData();
  }, [actionId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  // Convert the action record to our expected format
  const actionRecord = actionData ? {
    ...actionData,
    action_payload: typeof actionData.action_payload === 'object' ? actionData.action_payload : {},
    execution_result: typeof actionData.execution_result === 'object' ? 
      {
        success: Boolean(actionData.execution_result?.success),
        message: String(actionData.execution_result?.message || ''),
        ...actionData.execution_result
      } : null
  } as unknown as ActionRecord : null;

  return (
    <div>
      <h2>Test Results</h2>
      {actionRecord ? (
        <pre>{JSON.stringify(actionRecord, null, 2)}</pre>
      ) : (
        <div>No action data found.</div>
      )}
    </div>
  );
};

export default TestResults;
