
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ToolDefinitionCard from './ToolDefinitionCard';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ToolDefinitionsProps {
  rawDefinitions: string;
  onSave?: (definitions: string) => void;
  isSaving?: boolean;
}

const ToolDefinitionsPanel: React.FC<ToolDefinitionsProps> = ({ 
  rawDefinitions, 
  onSave,
  isSaving = false
}) => {
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');
  const [editedRawDefinitions, setEditedRawDefinitions] = useState(rawDefinitions);
  const [parsedTools, setParsedTools] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Parse tool definitions when raw definitions change
  useEffect(() => {
    try {
      if (rawDefinitions) {
        const tools = JSON.parse(rawDefinitions);
        setParsedTools(tools);
        setParseError(null);
        setEditedRawDefinitions(rawDefinitions);
      }
    } catch (error) {
      console.error('Error parsing tool definitions:', error);
      setParseError('Invalid JSON format in tool definitions');
      setParsedTools([]);
    }
  }, [rawDefinitions]);

  const handleSaveClick = () => {
    try {
      // Validate JSON before saving
      JSON.parse(editedRawDefinitions);
      
      if (onSave) {
        onSave(editedRawDefinitions);
      }
      
      setParseError(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: "Please fix the JSON formatting errors before saving."
      });
      setParseError('Invalid JSON format in tool definitions');
    }
  };

  // Get example return values for specific tools
  const getToolReturnType = (toolName: string) => {
    if (toolName === 'create_action_record') {
      return {
        type: 'object',
        description: 'Returns information about the created action record',
        properties: {
          status: { type: 'string' },
          action_record_id: { type: 'string' },
          message: { type: 'string' }
        }
      };
    }
    
    if (toolName === 'knowledge_base_lookup') {
      return {
        type: 'object',
        description: 'Returns search results from the knowledge base',
        properties: {
          results: { 
            type: 'array', 
            items: { 
              type: 'object',
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                relevance: { type: 'number' }
              }
            }
          },
          count: { type: 'number' }
        }
      };
    }
    
    return undefined;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Tool Definitions</CardTitle>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'visual' ? "default" : "outline"} 
            size="sm"
            onClick={() => setViewMode('visual')}
          >
            Visual
          </Button>
          <Button 
            variant={viewMode === 'raw' ? "default" : "outline"} 
            size="sm"
            onClick={() => setViewMode('raw')}
          >
            Raw JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {parseError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}
        
        {viewMode === 'visual' ? (
          <div className="space-y-4">
            {parsedTools.length > 0 ? (
              parsedTools.map((tool, index) => (
                <ToolDefinitionCard 
                  key={tool.name || index} 
                  tool={{
                    ...tool,
                    returnType: getToolReturnType(tool.name)
                  }} 
                />
              ))
            ) : (
              <div className="text-center p-8 text-gray-500">
                <p>No tool definitions available or invalid format</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Edit the raw JSON tool definitions below. Be careful to maintain valid JSON format.
              </AlertDescription>
            </Alert>
            
            <Textarea
              className="font-mono text-sm min-h-[400px]"
              value={editedRawDefinitions}
              onChange={(e) => setEditedRawDefinitions(e.target.value)}
            />
            
            <div className="flex justify-end">
              <Button 
                onClick={handleSaveClick} 
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ToolDefinitionsPanel;
