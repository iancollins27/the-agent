
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ActionRecord } from './types';
import PromptDisplay from './PromptDisplay';

interface TestResultsProps {
  actionId?: string;
  results?: any;
}

const TestResults: React.FC<TestResultsProps> = ({ actionId, results }) => {
  const [actionData, setActionData] = useState<any>(null);
  const [loading, setLoading] = useState(actionId ? true : false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [showOriginalPrompt, setShowOriginalPrompt] = useState<Record<string, boolean>>({});

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

  const togglePrompt = (resultIndex: string) => {
    setExpandedPrompts(prev => ({
      ...prev,
      [resultIndex]: !prev[resultIndex]
    }));
  };
  
  const toggleOriginalPrompt = (resultIndex: string) => {
    setShowOriginalPrompt(prev => ({
      ...prev,
      [resultIndex]: !prev[resultIndex]
    }));
  };

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
            <div className="space-y-4">
              {projectResult.results.map((result: any, resultIndex: number) => {
                const resultKey = `${index}-${resultIndex}`;
                const isPromptExpanded = expandedPrompts[resultKey] || false;
                const showOriginal = showOriginalPrompt[resultKey] || false;
                const isMCP = result.usedMCP || result.finalPrompt?.includes("Using Model Context Protocol");
                
                // Calculate metrics display
                const hasMetrics = result.promptTokens > 0 || result.completionTokens > 0;
                
                return (
                  <div key={resultIndex} className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Prompt Type: {result.type}</h4>
                      {isMCP && (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          MCP Enabled
                        </span>
                      )}
                    </div>
                    
                    {/* Metrics display if available */}
                    {hasMetrics && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center">
                          Prompt tokens: {result.promptTokens || 0}
                        </span>
                        <span className="inline-flex items-center">
                          Completion tokens: {result.completionTokens || 0}
                        </span>
                        {result.costUSD > 0 && (
                          <span className="inline-flex items-center font-medium text-emerald-700">
                            Cost: ${result.costUSD?.toFixed(4) || "0.0000"}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Prompt Input Section */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-muted-foreground">Prompt Input</p>
                        <button 
                          onClick={() => togglePrompt(resultKey)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          {isPromptExpanded ? 'Hide Prompt' : 'Show Prompt'}
                        </button>
                      </div>
                      
                      {isPromptExpanded && (
                        <div className="mt-2">
                          {isMCP && (
                            <div className="mb-2 bg-blue-50 p-2 rounded text-sm">
                              <p className="font-medium text-blue-700">
                                Using Model Context Protocol - Tool-based AI interaction
                              </p>
                              <p className="text-blue-600 text-xs">
                                MCP provides a more structured interaction with the AI model using tools instead
                                of direct prompting.
                              </p>
                              {result.originalPrompt && (
                                <button
                                  onClick={() => toggleOriginalPrompt(resultKey)}
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 underline"
                                >
                                  {showOriginal ? 'Hide original prompt' : 'Show original prompt'}
                                </button>
                              )}
                              {showOriginal && result.originalPrompt && (
                                <div className="mt-2 border-t border-blue-200 pt-2">
                                  <p className="text-xs text-blue-700 mb-1">Original prompt for reference:</p>
                                  <PromptDisplay 
                                    promptText={result.originalPrompt} 
                                    onEdit={() => {}} 
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          {(!isMCP || (isMCP && showOriginal)) && (
                            <PromptDisplay 
                              promptText={isMCP ? result.originalPrompt : result.finalPrompt} 
                              onEdit={() => {}} 
                            />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Output Section */}
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Output</p>
                      <div className="bg-muted p-3 rounded text-sm">
                        <pre className="whitespace-pre-wrap mt-1 text-xs">{result.output}</pre>
                      </div>
                      
                      {/* Additional result information */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                        {result.actionRecordId && (
                          <div className="bg-green-50 text-green-700 p-2 rounded">
                            <p className="font-medium">Action Record Created</p>
                            <p className="text-xs overflow-hidden text-ellipsis">{result.actionRecordId}</p>
                          </div>
                        )}
                        
                        {result.reminderSet && result.nextCheckDateInfo && (
                          <div className="bg-amber-50 text-amber-700 p-2 rounded">
                            <p className="font-medium">Reminder Set</p>
                            <p className="text-xs">
                              Next check date: {result.nextCheckDateInfo.newValue}
                            </p>
                          </div>
                        )}
                        
                        {result.knowledgeResults && result.knowledgeResults.length > 0 && (
                          <div className="bg-indigo-50 text-indigo-700 p-2 rounded">
                            <p className="font-medium">Knowledge Results</p>
                            <p className="text-xs">
                              {result.knowledgeResults.length} entries found
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Convert the action record to our expected format
  const actionRecord = actionData ? {
    ...actionData,
    action_payload: typeof actionData.action_payload === 'object' ? actionData.action_payload : {},
    execution_result: actionData.execution_result ? (
      typeof actionData.execution_result === 'object' ? {
        success: Boolean('success' in actionData.execution_result ? actionData.execution_result.success : false),
        message: String('message' in actionData.execution_result ? actionData.execution_result.message || '' : ''),
        ...(Array.isArray(actionData.execution_result) ? {} : actionData.execution_result)
      } : {
        success: false,
        message: String(actionData.execution_result || '')
      }
    ) : null
  } as ActionRecord : null;

  return (
    <div>
      <h2 className="text-xl font-bold">Action Record Details</h2>
      {actionData ? (
        <pre className="mt-4 p-4 bg-muted rounded-md overflow-auto text-xs">
          {JSON.stringify(actionData, null, 2)}
        </pre>
      ) : (
        <div>No action data found.</div>
      )}
    </div>
  );
};

export default TestResults;
