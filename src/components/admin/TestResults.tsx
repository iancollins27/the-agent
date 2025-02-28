
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestResult, workflowTitles } from "@/types/workflow";

type TestResultsProps = {
  results: TestResult[];
};

const TestResults = ({ results }: TestResultsProps) => {
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
