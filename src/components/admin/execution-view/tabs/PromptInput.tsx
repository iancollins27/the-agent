
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Tool from '@/components/icons/Tool';

interface PromptInputProps {
  promptRun: any; // Keep as any since it might have additional properties
}

const PromptInput: React.FC<PromptInputProps> = ({ promptRun }) => {
  // Determine if this is an MCP execution
  const isMCPExecution = promptRun.toolLogsCount ? 
    promptRun.toolLogsCount > 0 : // Use the property if it exists
    Array.isArray(promptRun.toolLogs) && promptRun.toolLogs.length > 0; // Fallback to checking toolLogs array

  // For MCP executions, we want to show the actual processed input that was sent to the LLM
  // This should be the final prompt after all variable substitutions
  let actualPromptInput = promptRun.prompt_input || '';
  
  // If this is MCP and we have tool logs, the actual input might be in a different field
  // or we might need to reconstruct it from the context
  if (isMCPExecution && promptRun.toolLogs && promptRun.toolLogs.length > 0) {
    // For MCP executions, check if we have the processed prompt in tool logs or other fields
    const firstToolLog = promptRun.toolLogs[0];
    if (firstToolLog && firstToolLog.input_data) {
      try {
        const inputData = typeof firstToolLog.input_data === 'string' 
          ? JSON.parse(firstToolLog.input_data) 
          : firstToolLog.input_data;
        
        // Look for the actual system prompt or messages that were sent
        if (inputData.messages && Array.isArray(inputData.messages)) {
          const systemMessage = inputData.messages.find(msg => msg.role === 'system');
          if (systemMessage && systemMessage.content) {
            actualPromptInput = systemMessage.content;
          }
        } else if (inputData.prompt) {
          actualPromptInput = inputData.prompt;
        }
      } catch (e) {
        console.error('Error parsing tool log input data:', e);
      }
    }
  }
  
  const toolsUsed = promptRun.toolLogs?.map(log => log.tool_name).filter((value, index, self) => 
    self.indexOf(value) === index
  ) || [];
  
  // Parse the prompt input to extract system prompt and milestone instructions
  const parsePromptInput = () => {
    try {
      const input = actualPromptInput;
      
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
        userPrompt: actualPromptInput || 'Error parsing prompt input' 
      };
    }
  };

  const { systemPrompt, milestoneInstructions, userPrompt } = parsePromptInput();
  
  // Always show content - if parsing fails, show raw input
  const hasContent = actualPromptInput && actualPromptInput.length > 0;
  const showFormatted = hasContent && (systemPrompt || milestoneInstructions);
  
  return (
    <Card className="border border-muted">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center flex-wrap">
          <div className="flex items-center">
            <Tool className="h-4 w-4 mr-2 text-blue-500" />
            <span>Actual Prompt Input (Processed)</span>
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
      </CardHeader>
      
      <CardContent className="pt-2">
        {!hasContent ? (
          <div className="text-center py-8 text-muted-foreground">
            No prompt input available for this execution
          </div>
        ) : showFormatted ? (
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
            {actualPromptInput}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PromptInput;
