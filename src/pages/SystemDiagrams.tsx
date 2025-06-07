
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SystemDiagramCanvas from '@/components/diagrams/SystemDiagramCanvas';
import DiagramToolbar from '@/components/diagrams/DiagramToolbar';
import DiagramLegend from '@/components/diagrams/DiagramLegend';
import { toast } from '@/components/ui/use-toast';

type DiagramType = 'high-level-architecture' | 'sms-chat' | 'communications' | 'actions' | 'testing';

const SystemDiagrams = () => {
  const [activeTab, setActiveTab] = useState<DiagramType>('high-level-architecture');
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const handleNodeClick = useCallback((nodeData: any) => {
    setSelectedNode(nodeData);
    toast({
      title: "Component Selected",
      description: `Clicked on: ${nodeData.text}`,
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    // GoJS zoom functionality would be implemented here
    console.log('Zoom in');
  }, []);

  const handleZoomOut = useCallback(() => {
    // GoJS zoom functionality would be implemented here
    console.log('Zoom out');
  }, []);

  const handleReset = useCallback(() => {
    // GoJS reset view functionality would be implemented here
    console.log('Reset view');
  }, []);

  const handleExport = useCallback(() => {
    // GoJS export functionality would be implemented here
    toast({
      title: "Export Started",
      description: "Diagram export functionality is being processed...",
    });
  }, []);

  const handleSearch = useCallback((term: string) => {
    // GoJS search functionality would be implemented here
    console.log('Search for:', term);
  }, []);

  const getDiagramInfo = (type: DiagramType) => {
    switch (type) {
      case 'high-level-architecture':
        return {
          title: 'High-Level Application Architecture',
          description: 'Two main orchestrators: Proactive Background Processing and Interactive Multi-Channel Chat',
          status: 'Active',
          functions: ['test-workflow-prompt', 'agent-chat', 'comms-business-logic', 'send-communication']
        };
      case 'sms-chat':
        return {
          title: 'SMS Chat Flow',
          description: 'Complete flow from Twilio SMS webhook to AI response and back to user',
          status: 'Active',
          functions: ['chat-webhook-twilio', 'agent-chat', 'send-channel-message', 'send-communication']
        };
      case 'communications':
        return {
          title: 'Communication Processing',
          description: 'Processing pipeline for incoming communications from various sources',
          status: 'Active',
          functions: ['comms-webhook-twilio', 'comms-webhook-normalizer', 'comms-business-logic']
        };
      case 'actions':
        return {
          title: 'Action Detection & Execution',
          description: 'AI-driven action detection, approval workflows, and execution system',
          status: 'Active',
          functions: ['test-workflow-prompt', 'create-action-record', 'data-push']
        };
      case 'testing':
        return {
          title: 'Testing & Admin Framework',
          description: 'Comprehensive testing system with AI prompt testing and admin controls',
          status: 'Active',
          functions: ['test-workflow-prompt', 'agent-chat']
        };
      default:
        return {
          title: 'Unknown',
          description: '',
          status: 'Unknown',
          functions: []
        };
    }
  };

  const diagramInfo = getDiagramInfo(activeTab);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">System Architecture Diagrams</h1>
        <p className="text-muted-foreground">Interactive visualization of system workflows and component relationships</p>
      </header>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DiagramType)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="high-level-architecture">High-Level</TabsTrigger>
          <TabsTrigger value="sms-chat">SMS Chat</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {diagramInfo.title}
                    <Badge variant={diagramInfo.status === 'Active' ? 'default' : 'secondary'}>
                      {diagramInfo.status}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {diagramInfo.description}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>Edge Functions: {diagramInfo.functions.length}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {diagramInfo.functions.map((func, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {func}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DiagramToolbar
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                onExport={handleExport}
                onSearch={handleSearch}
              />
              
              <SystemDiagramCanvas
                diagramType={activeTab}
                onNodeClick={handleNodeClick}
              />
              
              {selectedNode && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border">
                  <h4 className="font-medium text-sm">Selected Component</h4>
                  <p className="text-sm text-gray-600">{selectedNode.text}</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    Click nodes to see details
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Flow Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {getFlowDetails(activeTab).map((detail, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-medium">{detail.step}</div>
                          <div className="text-gray-600">{detail.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <DiagramLegend diagramType={activeTab} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function getFlowDetails(type: DiagramType) {
  switch (type) {
    case 'high-level-architecture':
      return [
        { step: 'Proactive Orchestrator', description: 'Monitors projects, detects needed actions, sets reminders, processes in background' },
        { step: 'Interactive Chat Orchestrator', description: 'Handles real-time multi-channel communications (SMS, Email, Web Chat)' },
        { step: 'Shared Infrastructure', description: 'Both orchestrators use the same database, AI processing, and action execution system' },
        { step: 'Cross-Communication', description: 'Chat system can trigger proactive workflows, proactive system can initiate communications' },
        { step: 'Multi-Company Support', description: 'Both systems designed to work across multiple companies and user contexts' },
        { step: 'Action Execution', description: 'Unified action system handles data updates, reminders, and communications from both orchestrators' }
      ];
    
    case 'sms-chat':
      return [
        { step: 'SMS Received', description: 'User sends SMS to Twilio number' },
        { step: 'Webhook Processing', description: 'chat-webhook-twilio processes the incoming message' },
        { step: 'Session Management', description: 'Get or create chat session for the conversation' },
        { step: 'AI Processing', description: 'agent-chat function processes message with available tools' },
        { step: 'Tool Execution', description: 'Execute channel_response tool to send reply' },
        { step: 'Message Sending', description: 'send-communication sends SMS response via Twilio' }
      ];
    
    case 'communications':
      return [
        { step: 'Webhook Input', description: 'Receive communication from external sources' },
        { step: 'Normalization', description: 'Convert to standard format across providers' },
        { step: 'Business Logic', description: 'Apply routing and processing rules' },
        { step: 'Project Detection', description: 'Identify associated projects' },
        { step: 'Processing Route', description: 'Route to single or multi-project handlers' },
        { step: 'AI Analysis', description: 'Process with workflow prompts and AI' }
      ];
    
    case 'actions':
      return [
        { step: 'Action Detection', description: 'AI analyzes content for required actions' },
        { step: 'Record Creation', description: 'Create action records in database' },
        { step: 'Approval Check', description: 'Determine if human approval is required' },
        { step: 'Execution', description: 'Execute approved actions automatically' },
        { step: 'Type Routing', description: 'Route to specific action handlers' },
        { step: 'Integration', description: 'Sync with external systems (CRM, etc.)' }
      ];
    
    case 'testing':
      return [
        { step: 'Test Setup', description: 'Configure test parameters in admin console' },
        { step: 'Execution', description: 'Run test through workflow prompt system' },
        { step: 'AI Processing', description: 'Process with selected AI provider' },
        { step: 'Tool Execution', description: 'Execute any required MCP tools' },
        { step: 'Results Collection', description: 'Gather and format test results' },
        { step: 'Feedback Loop', description: 'Collect user feedback and store results' }
      ];
    
    default:
      return [];
  }
}

export default SystemDiagrams;
