
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestResult, workflowTitles } from "@/types/workflow";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { ActionRecord } from "@/components/admin/types";

type TestResultsProps = {
  results: TestResult[];
};

const TestResults = ({ results }: TestResultsProps) => {
  const [actionRecords, setActionRecords] = useState<Record<string, ActionRecord>>({});
  
  useEffect(() => {
    // Collect all action record IDs
    const actionRecordIds = results
      .flatMap(result => 
        result.results
          .filter(promptResult => promptResult.actionRecordId)
          .map(promptResult => promptResult.actionRecordId)
      )
      .filter(Boolean) as string[];
      
    if (actionRecordIds.length === 0) return;
    
    // Fetch action record details
    const fetchActionRecords = async () => {
      const { data, error } = await supabase
        .from('action_records')
        .select('*')
        .in('id', actionRecordIds);
        
      if (!error && data) {
        const records: Record<string, ActionRecord> = {};
        data.forEach(record => {
          records[record.id] = record as ActionRecord;
        });
        setActionRecords(records);
      }
    };
    
    fetchActionRecords();
  }, [results]);

  if (!results.length) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Test Results</h3>
      {results.map((result) => (
        <Card key={result.projectId}>
          <CardHeader>
            <CardTitle>Project {result.projectId}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {result.results.map((promptResult, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-medium">
                    {workflowTitles[promptResult.type]}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-muted-foreground mb-2">
                        Actual Prompt Sent to API
                      </h5>
                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">
                        {promptResult.finalPrompt}
                      </pre>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-muted-foreground mb-2">
                        Response
                      </h5>
                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">
                        {promptResult.output}
                      </pre>
                    </div>
                  </div>
                  
                  {/* Show action record details if one was created */}
                  {promptResult.actionRecordId && (
                    <div className="mt-4 bg-green-50 p-4 rounded-md border border-green-200">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-100 text-green-800 px-3 py-1 text-sm font-medium">
                          Action Record Created
                        </Badge>
                        <span className="text-sm text-muted-foreground">ID: {promptResult.actionRecordId}</span>
                      </div>
                      
                      {actionRecords[promptResult.actionRecordId] ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <h6 className="text-sm font-medium text-gray-700 mb-1">Action Details</h6>
                            <ul className="text-sm space-y-1">
                              <li><span className="font-medium">Type:</span> {actionRecords[promptResult.actionRecordId].action_type}</li>
                              <li><span className="font-medium">Status:</span> {actionRecords[promptResult.actionRecordId].status}</li>
                              <li><span className="font-medium">Created:</span> {new Date(actionRecords[promptResult.actionRecordId].created_at).toLocaleString()}</li>
                              <li><span className="font-medium">Requires Approval:</span> {actionRecords[promptResult.actionRecordId].requires_approval ? 'Yes' : 'No'}</li>
                            </ul>
                          </div>
                          <div>
                            <h6 className="text-sm font-medium text-gray-700 mb-1">Action Payload</h6>
                            <pre className="whitespace-pre-wrap bg-muted p-2 rounded-md text-xs">
                              {JSON.stringify(actionRecords[promptResult.actionRecordId].action_payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading action record details...</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TestResults;
