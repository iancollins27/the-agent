
import React, { useEffect, useRef, useState } from 'react';
import * as go from 'gojs';

interface SystemDiagramCanvasProps {
  diagramType: 'sms-chat' | 'communications' | 'actions' | 'testing';
  onNodeClick?: (nodeData: any) => void;
}

const SystemDiagramCanvas: React.FC<SystemDiagramCanvasProps> = ({ 
  diagramType, 
  onNodeClick 
}) => {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);

  useEffect(() => {
    if (!diagramRef.current) return;

    const $ = go.GraphObject.make;

    const myDiagram = $(go.Diagram, diagramRef.current, {
      'undoManager.isEnabled': true,
      layout: $(go.TreeLayout, {
        angle: 0,
        layerSpacing: 50,
        nodeSpacing: 30
      }),
      initialContentAlignment: go.Spot.Center,
      'toolManager.hoverDelay': 100
    });

    // Define node template
    myDiagram.nodeTemplate = $(go.Node, 'Auto',
      {
        selectionAdorned: true,
        click: (e, node) => {
          if (onNodeClick) {
            onNodeClick(node.data);
          }
        }
      },
      $(go.Shape, 'RoundedRectangle', {
        fill: 'lightblue',
        stroke: 'navy',
        strokeWidth: 2
      }, new go.Binding('fill', 'color')),
      $(go.TextBlock, {
        margin: 8,
        font: 'bold 12px sans-serif',
        wrap: go.TextBlock.WrapFit,
        maxSize: new go.Size(120, NaN)
      }, new go.Binding('text', 'text'))
    );

    // Define link template
    myDiagram.linkTemplate = $(go.Link,
      { routing: go.Link.Orthogonal, corner: 5 },
      $(go.Shape, { strokeWidth: 2, stroke: '#555' }),
      $(go.Shape, { toArrow: 'Standard', stroke: '#555', fill: '#555' }),
      $(go.TextBlock, {
        textAlign: 'center',
        font: '10px sans-serif',
        background: 'white',
        margin: 2
      }, new go.Binding('text', 'text'))
    );

    // Set model data based on diagram type
    const modelData = getModelData(diagramType);
    myDiagram.model = new go.GraphLinksModel(modelData.nodeDataArray, modelData.linkDataArray);

    setDiagram(myDiagram);

    return () => {
      myDiagram.div = null;
    };
  }, [diagramType, onNodeClick]);

  return (
    <div 
      ref={diagramRef} 
      className="w-full h-96 border border-gray-300 rounded-lg bg-white"
      style={{ minHeight: '400px' }}
    />
  );
};

function getModelData(diagramType: string) {
  switch (diagramType) {
    case 'sms-chat':
      return {
        nodeDataArray: [
          { key: 'twilio', text: 'Twilio SMS\nWebhook', color: '#E3F2FD' },
          { key: 'webhook', text: 'chat-webhook-twilio', color: '#F3E5F5' },
          { key: 'session', text: 'Chat Session\nManager', color: '#E8F5E8' },
          { key: 'agent', text: 'agent-chat\nFunction', color: '#FFF3E0' },
          { key: 'tools', text: 'Available Tools\n(channel_response)', color: '#FCE4EC' },
          { key: 'response', text: 'send-channel-message', color: '#E0F2F1' },
          { key: 'send-comm', text: 'send-communication', color: '#F1F8E9' },
          { key: 'twilio-send', text: 'Twilio API\nSend SMS', color: '#FFF8E1' }
        ],
        linkDataArray: [
          { from: 'twilio', to: 'webhook', text: 'POST' },
          { from: 'webhook', to: 'session', text: 'get/create' },
          { from: 'webhook', to: 'agent', text: 'process' },
          { from: 'agent', to: 'tools', text: 'execute' },
          { from: 'tools', to: 'response', text: 'channel_response' },
          { from: 'response', to: 'send-comm', text: 'SMS' },
          { from: 'send-comm', to: 'twilio-send', text: 'API call' }
        ]
      };

    case 'communications':
      return {
        nodeDataArray: [
          { key: 'webhook', text: 'Communication\nWebhook', color: '#E3F2FD' },
          { key: 'normalizer', text: 'Webhook\nNormalizer', color: '#F3E5F5' },
          { key: 'business', text: 'Business Logic\nProcessor', color: '#E8F5E8' },
          { key: 'detect', text: 'Project\nDetection', color: '#FFF3E0' },
          { key: 'single', text: 'Single Project\nProcessor', color: '#FCE4EC' },
          { key: 'multi', text: 'Multi Project\nProcessor', color: '#E0F2F1' },
          { key: 'workflow', text: 'test-workflow-prompt', color: '#F1F8E9' },
          { key: 'actions', text: 'Action Record\nCreation', color: '#FFF8E1' }
        ],
        linkDataArray: [
          { from: 'webhook', to: 'normalizer', text: 'raw data' },
          { from: 'normalizer', to: 'business', text: 'normalized' },
          { from: 'business', to: 'detect', text: 'analyze' },
          { from: 'detect', to: 'single', text: 'single' },
          { from: 'detect', to: 'multi', text: 'multiple' },
          { from: 'single', to: 'workflow', text: 'AI process' },
          { from: 'multi', to: 'workflow', text: 'batch process' },
          { from: 'workflow', to: 'actions', text: 'create actions' }
        ]
      };

    case 'actions':
      return {
        nodeDataArray: [
          { key: 'detection', text: 'Action Detection\n(AI Analysis)', color: '#E3F2FD' },
          { key: 'record', text: 'Action Record\nCreation', color: '#F3E5F5' },
          { key: 'approval', text: 'Approval\nProcess', color: '#E8F5E8' },
          { key: 'execution', text: 'Action\nExecution', color: '#FFF3E0' },
          { key: 'message', text: 'Message\nActions', color: '#FCE4EC' },
          { key: 'data', text: 'Data Update\nActions', color: '#E0F2F1' },
          { key: 'reminder', text: 'Reminder\nActions', color: '#F1F8E9' },
          { key: 'crm', text: 'CRM\nIntegration', color: '#FFF8E1' }
        ],
        linkDataArray: [
          { from: 'detection', to: 'record', text: 'create' },
          { from: 'record', to: 'approval', text: 'requires approval' },
          { from: 'approval', to: 'execution', text: 'approved' },
          { from: 'execution', to: 'message', text: 'message type' },
          { from: 'execution', to: 'data', text: 'data type' },
          { from: 'execution', to: 'reminder', text: 'reminder type' },
          { from: 'data', to: 'crm', text: 'sync' },
          { from: 'message', to: 'crm', text: 'log' }
        ]
      };

    case 'testing':
      return {
        nodeDataArray: [
          { key: 'admin', text: 'Admin Console\nInterface', color: '#E3F2FD' },
          { key: 'test-runner', text: 'Test Runner\nComponent', color: '#F3E5F5' },
          { key: 'workflow-test', text: 'test-workflow-prompt\nFunction', color: '#E8F5E8' },
          { key: 'ai-providers', text: 'AI Providers\n(OpenAI/Claude)', color: '#FFF3E0' },
          { key: 'tools', text: 'MCP Tools\nExecution', color: '#FCE4EC' },
          { key: 'results', text: 'Test Results\nDisplay', color: '#E0F2F1' },
          { key: 'database', text: 'Database\nLogging', color: '#F1F8E9' },
          { key: 'feedback', text: 'Feedback\nSystem', color: '#FFF8E1' }
        ],
        linkDataArray: [
          { from: 'admin', to: 'test-runner', text: 'user input' },
          { from: 'test-runner', to: 'workflow-test', text: 'execute test' },
          { from: 'workflow-test', to: 'ai-providers', text: 'AI request' },
          { from: 'workflow-test', to: 'tools', text: 'tool calls' },
          { from: 'tools', to: 'database', text: 'log actions' },
          { from: 'workflow-test', to: 'results', text: 'response' },
          { from: 'results', to: 'feedback', text: 'user rating' },
          { from: 'feedback', to: 'database', text: 'store feedback' }
        ]
      };

    default:
      return { nodeDataArray: [], linkDataArray: [] };
  }
}

export default SystemDiagramCanvas;
