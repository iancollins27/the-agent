
import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function UpdateProjectEmbeddings() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [processedProjects, setProcessedProjects] = useState(0);
  const { toast } = useToast();

  const countProjects = async () => {
    try {
      const { count, error } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error("Error counting projects:", error);
      return 0;
    }
  };

  const updateAllProjectEmbeddings = async () => {
    try {
      setIsLoading(true);
      setResults([]);
      
      // First, get the total count of projects
      const total = await countProjects();
      setTotalProjects(total);
      
      if (total === 0) {
        toast({
          title: "No projects found",
          description: "There are no projects to update embeddings for.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Process in batches
      const batchSize = 20;
      let processed = 0;
      
      while (processed < total) {
        const { data, error } = await supabase.functions.invoke('update-project-embeddings', {
          body: {
            processAll: true,
            batchSize: batchSize
          }
        });

        if (error) throw error;
        
        // Update progress
        processed += data.processed || 0;
        setProcessedProjects(processed);
        setProgress(Math.min((processed / total) * 100, 100));
        
        // Add results
        if (data.results) {
          setResults(prev => [...prev, ...data.results]);
        }
        
        // If we processed less than the batch size, we're done
        if (data.processed < batchSize) break;
      }

      toast({
        title: "Success",
        description: `Updated embeddings for ${processed} projects.`,
      });
    } catch (error: any) {
      console.error("Error updating embeddings:", error);
      toast({
        title: "Error updating embeddings",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateSingleProject = async (projectId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('update-project-embeddings', {
        body: {
          projectId: projectId
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Updated embeddings for project ${projectId}.`,
      });

      return data;
    } catch (error: any) {
      console.error(`Error updating project ${projectId}:`, error);
      toast({
        title: "Error updating project",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Update Project Embeddings</CardTitle>
          <CardDescription>
            Generate or update vector embeddings for all projects to enable semantic search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <p>Processing {processedProjects} of {totalProjects} projects...</p>
              <Progress value={progress} />
            </div>
          )}
          
          {results.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium">Results:</h3>
              <div className="max-h-60 overflow-y-auto mt-2 border rounded p-2">
                {results.map((result, idx) => (
                  <div key={idx} className="text-sm py-1 border-b last:border-0">
                    <span className={result.success ? "text-green-600" : "text-red-600"}>
                      {result.projectId}: {result.success ? "Success" : `Error: ${result.error}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={updateAllProjectEmbeddings} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Updating..." : "Update All Project Embeddings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
