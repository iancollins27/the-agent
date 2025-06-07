
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LegendItem {
  color: string;
  label: string;
  description: string;
}

interface DiagramLegendProps {
  diagramType: string;
}

const DiagramLegend: React.FC<DiagramLegendProps> = ({ diagramType }) => {
  const getLegendItems = (type: string): LegendItem[] => {
    switch (type) {
      case 'high-level-architecture':
        return [
          { color: '#FF6B6B', label: 'Proactive Orchestrator', description: 'Background processing system' },
          { color: '#FFE66D', label: 'Proactive Components', description: 'Project monitoring and workflows' },
          { color: '#4ECDC4', label: 'Chat Orchestrator', description: 'Interactive communication system' },
          { color: '#95E1D3', label: 'Chat Components', description: 'Multi-channel handlers' },
          { color: '#A8E6CF', label: 'Shared Infrastructure', description: 'Common system components' },
          { color: '#DDA0DD', label: 'Core Services', description: 'Database, AI, integrations' }
        ];
      
      case 'sms-chat':
        return [
          { color: '#E3F2FD', label: 'External Service', description: 'Twilio webhook endpoints' },
          { color: '#F3E5F5', label: 'Webhook Handler', description: 'Initial request processing' },
          { color: '#E8F5E8', label: 'Session Management', description: 'Chat session handling' },
          { color: '#FFF3E0', label: 'AI Processing', description: 'Agent chat and AI tools' },
          { color: '#FCE4EC', label: 'Tool Execution', description: 'Available system tools' },
          { color: '#E0F2F1', label: 'Response Handler', description: 'Message sending logic' }
        ];
      
      case 'communications':
        return [
          { color: '#E3F2FD', label: 'Input', description: 'Webhook receivers' },
          { color: '#F3E5F5', label: 'Processing', description: 'Data normalization' },
          { color: '#E8F5E8', label: 'Business Logic', description: 'Core processing rules' },
          { color: '#FFF3E0', label: 'Detection', description: 'Project identification' },
          { color: '#FCE4EC', label: 'Single Project', description: 'Individual project handling' },
          { color: '#E0F2F1', label: 'Multi Project', description: 'Batch processing' }
        ];
      
      case 'actions':
        return [
          { color: '#E3F2FD', label: 'AI Analysis', description: 'Action detection via AI' },
          { color: '#F3E5F5', label: 'Record Creation', description: 'Database record management' },
          { color: '#E8F5E8', label: 'Approval Flow', description: 'Human approval process' },
          { color: '#FFF3E0', label: 'Execution', description: 'Action implementation' },
          { color: '#FCE4EC', label: 'Communication', description: 'Message sending actions' },
          { color: '#E0F2F1', label: 'Data Operations', description: 'Database updates' }
        ];
      
      case 'testing':
        return [
          { color: '#E3F2FD', label: 'User Interface', description: 'Admin console components' },
          { color: '#F3E5F5', label: 'Test Framework', description: 'Testing infrastructure' },
          { color: '#E8F5E8', label: 'Execution Engine', description: 'Test execution logic' },
          { color: '#FFF3E0', label: 'AI Integration', description: 'AI provider connections' },
          { color: '#FCE4EC', label: 'Tool System', description: 'MCP tool execution' },
          { color: '#E0F2F1', label: 'Results', description: 'Output and feedback' }
        ];
      
      default:
        return [];
    }
  };

  const legendItems = getLegendItems(diagramType);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Legend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded border"
                style={{ backgroundColor: item.color }}
              />
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-gray-600">{item.description}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DiagramLegend;
