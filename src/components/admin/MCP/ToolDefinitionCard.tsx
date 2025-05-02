
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, Code, Input, Output, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Parameter {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, Parameter>;
    required: string[];
  };
  returnType?: {
    type: string;
    description?: string;
    properties?: Record<string, any>;
  };
}

interface ToolDefinitionCardProps {
  tool: ToolDefinition;
}

const ToolDefinitionCard: React.FC<ToolDefinitionCardProps> = ({ tool }) => {
  const [expanded, setExpanded] = useState(false);
  
  const renderPropertyType = (property: Parameter) => {
    if (property.enum) {
      return <Badge variant="outline" className="font-mono text-xs">enum</Badge>;
    }
    
    if (property.type === 'object' && property.properties) {
      return <Badge variant="outline" className="font-mono text-xs">object</Badge>;
    }
    
    if (property.type === 'array' && property.items) {
      return <Badge variant="outline" className="font-mono text-xs">array</Badge>;
    }
    
    return <Badge variant="outline" className="font-mono text-xs">{property.type}</Badge>;
  };

  return (
    <Card className="mb-4 overflow-hidden border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="p-4 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-lg">{tool.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Show less" : "Show more"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        <div className="px-4 py-3">
          <p className="text-gray-600">{tool.description}</p>
        </div>

        <div className={cn("px-4 pb-4", !expanded && "hidden")}>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Input className="h-4 w-4 text-blue-600" />
              <h3 className="font-medium text-sm">Input Parameters</h3>
            </div>
            
            <div className="rounded-md border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parameter</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(tool.parameters.properties).map(([key, property]) => (
                    <tr key={key}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{key}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {renderPropertyType(property)}
                        {property.enum && (
                          <div className="mt-1">
                            <div className="flex flex-wrap gap-1 mt-1">
                              {property.enum.map((value) => (
                                <Badge key={value} variant="secondary" className="text-xs">{value}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{property.description || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {tool.parameters.required?.includes(key) ? (
                          <Badge variant="default" className="bg-red-100 text-red-800 hover:bg-red-100">Required</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Optional</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {tool.returnType && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Output className="h-4 w-4 text-green-600" />
                <h3 className="font-medium text-sm">Return Value</h3>
              </div>
              <div className="rounded-md border p-3 bg-gray-50">
                <p className="text-sm text-gray-700 mb-2">
                  {tool.returnType.description || "Returns the following structure:"}
                </p>
                <pre className="text-xs bg-slate-100 p-3 rounded overflow-auto">
                  {JSON.stringify(tool.returnType.properties || { type: tool.returnType.type }, null, 2)}
                </pre>
              </div>
            </div>
          )}
          
          {(tool.name === 'create_action_record' || tool.name === 'knowledge_base_lookup') && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-800">
                  {tool.name === 'create_action_record' 
                    ? 'This tool creates action records in the system that can be approved and executed by team members.'
                    : 'This tool searches the knowledge base for information relevant to the current context.'}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <Separator />
        
        <div className="px-4 py-2 text-right">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : "Show details"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ToolDefinitionCard;
