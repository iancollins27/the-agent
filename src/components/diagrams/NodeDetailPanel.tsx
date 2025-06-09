
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface NodeDetailPanelProps {
  nodeData: {
    text: string;
    description?: string;
    edgeFunctions?: string[];
    fileReferences?: string[];
    color: string;
  };
}

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ nodeData }) => {
  const { text, description, edgeFunctions = [], fileReferences = [] } = nodeData;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div 
            className="w-4 h-4 rounded"
            style={{ backgroundColor: nodeData.color }}
          />
          {text}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <div>
            <h4 className="font-medium text-sm mb-2">Description</h4>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        )}
        
        {edgeFunctions.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2">Edge Functions</h4>
            <div className="flex flex-wrap gap-1">
              {edgeFunctions.map((func, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {func}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {fileReferences.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2">File References</h4>
            <div className="space-y-1">
              {fileReferences.map((file, idx) => (
                <div key={idx} className="text-xs text-gray-500 font-mono bg-gray-50 p-1 rounded">
                  {file}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <Separator />
        
        <div className="text-xs text-gray-500">
          Click other nodes to see their details
        </div>
      </CardContent>
    </Card>
  );
};

export default NodeDetailPanel;
