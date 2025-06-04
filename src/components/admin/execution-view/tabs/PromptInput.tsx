
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import Tool from '@/components/icons/Tool';

interface PromptInputProps {
  promptRun: any; // Keep as any since it might have additional properties
}

const PromptInput: React.FC<PromptInputProps> = ({ promptRun }) => {
  const [viewType, setViewType] = useState<'formatted' | 'raw'>('formatted');
  
  // Determine if this is an MCP execution
  const isMCPExecution = promptRun.toolLogsCount ? 
    promptRun.toolLogsCount > 0 : // Use the property if it exists
    Array.isArray(promptRun.toolLogs) && promptRun.toolLogs.length > 0; // Fallback to checking toolLogs array

  // Get the raw prompt input
  const rawPromptInput = promptRun.prompt_input || '';
  
  const toolsUsed = promptRun.toolLogs?.map(log => log.tool_name).filter((value, index, self) => 
    self.indexOf(value) === index
  ) || [];
  
  // Parse the prompt input to extract system prompt and milestone instructions
  const parsePromptInput = () => {
    try {
      const input = rawPromptInput;
      
      // If there's no input, return empty structure
      if (!input || typeof input !== 'string') {
        return { 
          systemPrompt: '', 
          milestoneInstructions: '', 
          userPrompt: 'No prompt input available' 
        };
      }
      
      // Check if this is likely a system prompt with milestone instructions
      if (input.includes('MILESTONE INSTRUCTIONS:')) {
        const parts = input.split('MILESTONE INSTRUCTIONS:');
        if (parts.length > 1) {
          // Extract milestone instructions section
          const milestoneSection = parts[1].split('\n\n')[0].trim();
          return {
            systemPrompt: parts[0].trim(),
            milestoneInstructions: milestoneSection,
            userPrompt: parts[1].split('\n\n').slice(1).join('\n\n').trim()
          };
        }
      }
      
      // If no milestone instructions, try to detect system/user prompt structure
      if (input.includes('System:') || input.includes('User:')) {
        const systemMatch = input.match(/System:\s*([\s\S]*?)(?=User:|$)/);
        const userMatch = input.match(/User:\s*([\s\S]*?)$/);
        
        return {
          systemPrompt: systemMatch ? systemMatch[1].trim() : '',
          milestoneInstructions: '',
          userPrompt: userMatch ? userMatch[1].trim() : input
        };
      }
      
      // Default: treat entire input as user prompt
      return { 
        systemPrompt: '', 
        milestoneInstructions: '', 
        userPrompt: input 
      };
    } catch (e) {
      console.error('Error parsing prompt input:', e);
      return { 
        systemPrompt: '', 
        milestoneInstructions: '', 
        userPrompt: rawPromptInput || 'Error parsing prompt input' 
      };
    }
  };

  const { systemPrompt, milestoneInstructions, userPrompt } = parsePromptInput();
  
  // Always show content - if parsing fails, show raw input
  const hasContent = rawPromptInput && rawPromptInput.length > 0;
  const showFormatted = hasContent && (systemPrompt || milestoneInstructions);
  
  return (
    <Card className="border border-muted">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center flex-wrap">
          <div className="flex items-center">
            <Tool className="h-4 w-4 mr-2 text-blue-500" />
            <span>Prompt Input</span>
            {isMCPExecution && <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">MCP</Badge>}
          </div>
          
          {toolsUsed.length > 0 && (
            <div className="ml-auto flex flex-wrap gap-1 mt-1 sm:mt-0">
              {toolsUsed.map(tool => (
                <Badge key={tool} variant="secondary" className="text-xs">
                  {tool}
                </Badge>
              ))}
            </div>
          )}
        </CardTitle>
        
        {hasContent && (
          <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'formatted' | 'raw')} className="w-full mt-2">
            <TabsList className="grid grid-cols-2 w-52">
              <TabsTrigger value="formatted">Formatted</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </CardHeader>
      
      <CardContent className="pt-2">
        {!hasContent ? (
          <div className="text-center py-8 text-muted-foreground">
            No prompt input available for this execution
          </div>
        ) : (
          <>
            <TabsContent value="raw" className={viewType === 'raw' ? 'block' : 'hidden'}>
              <div className="font-mono text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md overflow-x-auto max-h-[50vh] overflow-y-auto">
                {rawPromptInput}
              </div>
            </TabsContent>
            
            <TabsContent value="formatted" className={viewType === 'formatted' ? 'block' : 'hidden'}>
              {showFormatted ? (
                <div className="space-y-4">
                  {systemPrompt && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">System Prompt</h3>
                      <div className="font-mono text-sm whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 p-4 rounded-md overflow-x-auto max-h-[30vh] overflow-y-auto border">
                        {systemPrompt}
                      </div>
                    </div>
                  )}
                  
                  {milestoneInstructions && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Milestone Instructions</h3>
                      <div className="font-mono text-sm whitespace-pre-wrap bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md overflow-x-auto max-h-[20vh] overflow-y-auto border border-blue-100 dark:border-blue-800">
                        {milestoneInstructions}
                      </div>
                    </div>
                  )}
                  
                  {userPrompt && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">User Prompt</h3>
                      <div className="font-mono text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md overflow-x-auto max-h-[30vh] overflow-y-auto">
                        {userPrompt}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="font-mono text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md overflow-x-auto max-h-[50vh] overflow-y-auto">
                  {rawPromptInput}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PromptInput;
