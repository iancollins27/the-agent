
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ActionRecord } from './types';

interface TestResultsProps {
  actionId?: string;
  results?: any;
}

const TestResults: React.FC<TestResultsProps> = ({ actionId, results }) => {
  const [actionData, setActionData] = useState<any>(null);
  const [loading, setLoading] = useState(actionId ? true : false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    // Only fetch action data if actionId is provided
    if (actionId) {
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
    }
  }, [actionId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  // If results are passed directly, display them
  if (results) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Test Results</h2>
        {results.map((projectResult: any, index: number) => (
          <div key={index} className="border rounded-md p-4 space-y-4">
            <h3 className="text-lg font-medium">Project ID: {projectResult.projectId}</h3>
            <div className="space-y-2">
              {projectResult.results.map((result: any, resultIndex: number) => (
                <div key={resultIndex} className="border-t pt-3">
                  <h4 className="font-medium">Prompt Type: {result.type}</h4>
                  <div className="mt-2 space-y-2">
                    <div className="bg-muted p-3 rounded text-sm">
                      <p className="font-medium">Output:</p>
                      <pre className="whitespace-pre-wrap mt-1 text-xs">{result.output}</pre>
                    </div>
                    {result.actionRecordId && (
                      <div className="text-sm">
                        <p>Action Record ID: {result.actionRecordId}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Convert the action record to our expected format (for backward compatibility)
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
      <h2 className="text-xl font-bold">Action Record Details</h2>
      {actionRecord ? (
        <pre className="mt-4 p-4 bg-muted rounded-md overflow-auto text-xs">
          {JSON.stringify(actionRecord, null, 2)}
        </pre>
      ) : (
        <div>No action data found.</div>
      )}
    </div>
  );
};

export default TestResults;
