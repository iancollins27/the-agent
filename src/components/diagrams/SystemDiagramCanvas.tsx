import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as go from 'gojs';

interface SystemDiagramCanvasProps {
  diagramType: 'high-level-architecture' | 'sms-chat' | 'communications' | 'actions' | 'testing';
  onNodeClick?: (nodeData: any) => void;
}

export interface DiagramControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  exportPNG: () => void;
  searchNodes: (term: string) => void;
}

const SystemDiagramCanvas = forwardRef<DiagramControls, SystemDiagramCanvasProps>(({ 
  diagramType, 
  onNodeClick 
}, ref) => {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [diagram, setDiagram] = useState<go.Diagram | null>(null);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (diagram) {
        const currentScale = diagram.scale;
        if (currentScale < 3) { // Max zoom limit
          diagram.scale = Math.min(currentScale * 1.2, 3);
        }
      }
    },
    zoomOut: () => {
      if (diagram) {
        const currentScale = diagram.scale;
        if (currentScale > 0.1) { // Min zoom limit
          diagram.scale = Math.max(currentScale / 1.2, 0.1);
        }
      }
    },
    resetView: () => {
      if (diagram) {
        diagram.scale = 1;
        diagram.position = new go.Point(0, 0);
        diagram.centerRect(diagram.documentBounds);
      }
    },
    exportPNG: () => {
      if (diagram) {
        const dataUrl = diagram.makeImageData({
          background: 'white',
          returnType: 'dataUrl',
          maxSize: new go.Size(2000, 2000)
        });
        
        // Create download link
        const link = document.createElement('a');
        link.download = `${diagramType}-diagram.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    searchNodes: (term: string) => {
      if (!diagram || !term.trim()) {
        // Clear any existing highlights
        diagram?.nodes.each((node) => {
          const shape = node.findObject('SHAPE') as go.Shape;
          if (shape) {
            shape.stroke = 'navy';
            shape.strokeWidth = 2;
          }
        });
        return;
      }

      let found = false;
      diagram.nodes.each((node) => {
        const shape = node.findObject('SHAPE') as go.Shape;
        const text = node.data?.text?.toLowerCase() || '';
        
        if (text.includes(term.toLowerCase())) {
          if (shape) {
            shape.stroke = '#ff6b6b';
            shape.strokeWidth = 4;
          }
          found = true;
        } else if (shape) {
          shape.stroke = 'navy';
          shape.strokeWidth = 2;
        }
      });

      if (found) {
        console.log(`Found nodes matching: ${term}`);
      } else {
        console.log(`No nodes found matching: ${term}`);
      }
    }
  }), [diagram, diagramType]);

  useEffect(() => {
    if (!diagramRef.current) return;

    const $ = go.GraphObject.make;

    // Initialize diagram with proper error handling
    let myDiagram: go.Diagram;
    
    try {
      myDiagram = $(go.Diagram, diagramRef.current, {
        'undoManager.isEnabled': true,
        layout: diagramType === 'high-level-architecture' ? 
          $(go.LayeredDigraphLayout, {
            direction: 0,
            layerSpacing: 100,
            columnSpacing: 50
          }) :
          $(go.TreeLayout, {
            angle: 0,
            layerSpacing: 50,
            nodeSpacing: 30
          }),
        initialContentAlignment: go.Spot.Center,
        'toolManager.hoverDelay': 100,
        allowZoom: true,
        allowHorizontalScroll: true,
        allowVerticalScroll: true
      });

      // Define node template with proper error handling
      myDiagram.nodeTemplate = $(go.Node, 'Auto',
        {
          selectionAdorned: true,
          click: (e: go.InputEvent, obj: go.GraphObject) => {
            if (onNodeClick && obj.part && obj.part instanceof go.Node) {
              const node = obj.part as go.Node;
              if (node.data) {
                onNodeClick(node.data);
              }
            }
          }
        },
        $(go.Shape, 'RoundedRectangle', {
          name: 'SHAPE',
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
      
      // Ensure model data is valid before setting
      if (modelData && modelData.nodeDataArray && modelData.linkDataArray) {
        myDiagram.model = new go.GraphLinksModel(modelData.nodeDataArray, modelData.linkDataArray);
      } else {
        // Fallback to empty model
        myDiagram.model = new go.GraphLinksModel([], []);
      }

      setDiagram(myDiagram);
    } catch (error) {
      console.error('Error initializing GoJS diagram:', error);
      // Create a minimal fallback diagram
      myDiagram = $(go.Diagram, diagramRef.current);
      myDiagram.model = new go.GraphLinksModel([], []);
      setDiagram(myDiagram);
    }

    return () => {
      if (myDiagram) {
        myDiagram.div = null;
      }
    };
  }, [diagramType, onNodeClick]);

  return (
    <div 
      ref={diagramRef} 
      className="w-full h-96 border border-gray-300 rounded-lg bg-white"
      style={{ minHeight: '400px' }}
    />
  );
});

SystemDiagramCanvas.displayName = 'SystemDiagramCanvas';

function getModelData(diagramType: string) {
  // Ensure all data objects have required properties
  const createNode = (key: string, text: string, color: string) => ({
    key,
    text: text || 'Unnamed',
    color: color || '#E3F2FD'
  });

  const createLink = (from: string, to: string, text?: string) => ({
    from,
    to,
    text: text || ''
  });

  switch (diagramType) {
    case 'high-level-architecture':
      return {
        nodeDataArray: [
          createNode('proactive-orchestrator', 'Proactive Background\nOrchestrator', '#FF6B6B'),
          createNode('project-monitor', 'Project\nMonitoring', '#FFE66D'),
          createNode('workflow-engine', 'Workflow\nEngine', '#FFE66D'),
          createNode('action-detection', 'Action\nDetection', '#FFE66D'),
          createNode('reminder-system', 'Self-Reminder\nSystem', '#FFE66D'),
          
          createNode('chat-orchestrator', 'Interactive Chat\nOrchestrator', '#4ECDC4'),
          createNode('multi-channel', 'Multi-Channel\nHandler', '#95E1D3'),
          createNode('sms-handler', 'SMS\nHandler', '#95E1D3'),
          createNode('email-handler', 'Email\nHandler', '#95E1D3'),
          createNode('web-chat', 'Web Chat\nHandler', '#95E1D3'),
          createNode('support-agent', 'Support Agent\nInterface', '#95E1D3'),
          
          createNode('shared-infra', 'Shared Infrastructure', '#A8E6CF'),
          createNode('database', 'Database\n(Projects, Actions)', '#DDA0DD'),
          createNode('ai-engine', 'AI Processing\nEngine', '#DDA0DD'),
          createNode('action-executor', 'Action Execution\nSystem', '#DDA0DD'),
          createNode('integrations', 'External\nIntegrations', '#DDA0DD'),
          createNode('multi-company', 'Multi-Company\nSupport', '#DDA0DD')
        ],
        linkDataArray: [
          // Proactive orchestrator connections
          createLink('proactive-orchestrator', 'project-monitor', 'monitors'),
          createLink('proactive-orchestrator', 'workflow-engine', 'executes'),
          createLink('proactive-orchestrator', 'action-detection', 'detects'),
          createLink('proactive-orchestrator', 'reminder-system', 'schedules'),
          
          // Chat orchestrator connections
          createLink('chat-orchestrator', 'multi-channel', 'routes'),
          createLink('multi-channel', 'sms-handler', ''),
          createLink('multi-channel', 'email-handler', ''),
          createLink('multi-channel', 'web-chat', ''),
          createLink('chat-orchestrator', 'support-agent', 'assists'),
          
          // Shared infrastructure connections
          createLink('proactive-orchestrator', 'shared-infra', 'uses'),
          createLink('chat-orchestrator', 'shared-infra', 'uses'),
          createLink('shared-infra', 'database', ''),
          createLink('shared-infra', 'ai-engine', ''),
          createLink('shared-infra', 'action-executor', ''),
          createLink('shared-infra', 'integrations', ''),
          createLink('shared-infra', 'multi-company', ''),
          
          // Cross-communication
          createLink('chat-orchestrator', 'proactive-orchestrator', 'triggers'),
          createLink('proactive-orchestrator', 'chat-orchestrator', 'initiates')
        ]
      };

    case 'sms-chat':
      return {
        nodeDataArray: [
          createNode('twilio', 'Twilio SMS\nWebhook', '#E3F2FD'),
          createNode('webhook', 'chat-webhook-twilio', '#F3E5F5'),
          createNode('session', 'Chat Session\nManager', '#E8F5E8'),
          createNode('agent', 'agent-chat\nFunction', '#FFF3E0'),
          createNode('tools', 'Available Tools\n(channel_response)', '#FCE4EC'),
          createNode('response', 'send-channel-message', '#E0F2F1'),
          createNode('send-comm', 'send-communication', '#F1F8E9'),
          createNode('twilio-send', 'Twilio API\nSend SMS', '#FFF8E1')
        ],
        linkDataArray: [
          createLink('twilio', 'webhook', 'POST'),
          createLink('webhook', 'session', 'get/create'),
          createLink('webhook', 'agent', 'process'),
          createLink('agent', 'tools', 'execute'),
          createLink('tools', 'response', 'channel_response'),
          createLink('response', 'send-comm', 'SMS'),
          createLink('send-comm', 'twilio-send', 'API call')
        ]
      };

    case 'communications':
      return {
        nodeDataArray: [
          createNode('webhook', 'Communication\nWebhook', '#E3F2FD'),
          createNode('normalizer', 'Webhook\nNormalizer', '#F3E5F5'),
          createNode('business', 'Business Logic\nProcessor', '#E8F5E8'),
          createNode('detect', 'Project\nDetection', '#FFF3E0'),
          createNode('single', 'Single Project\nProcessor', '#FCE4EC'),
          createNode('multi', 'Multi Project\nProcessor', '#E0F2F1'),
          createNode('workflow', 'test-workflow-prompt', '#F1F8E9'),
          createNode('actions', 'Action Record\nCreation', '#FFF8E1')
        ],
        linkDataArray: [
          createLink('webhook', 'normalizer', 'raw data'),
          createLink('normalizer', 'business', 'normalized'),
          createLink('business', 'detect', 'analyze'),
          createLink('detect', 'single', 'single'),
          createLink('detect', 'multi', 'multiple'),
          createLink('single', 'workflow', 'AI process'),
          createLink('multi', 'workflow', 'batch process'),
          createLink('workflow', 'actions', 'create actions')
        ]
      };

    case 'actions':
      return {
        nodeDataArray: [
          createNode('detection', 'Action Detection\n(AI Analysis)', '#E3F2FD'),
          createNode('record', 'Action Record\nCreation', '#F3E5F5'),
          createNode('approval', 'Approval\nProcess', '#E8F5E8'),
          createNode('execution', 'Action\nExecution', '#FFF3E0'),
          createNode('message', 'Message\nActions', '#FCE4EC'),
          createNode('data', 'Data Update\nActions', '#E0F2F1'),
          createNode('reminder', 'Reminder\nActions', '#F1F8E9'),
          createNode('crm', 'CRM\nIntegration', '#FFF8E1')
        ],
        linkDataArray: [
          createLink('detection', 'record', 'create'),
          createLink('record', 'approval', 'requires approval'),
          createLink('approval', 'execution', 'approved'),
          createLink('execution', 'message', 'message type'),
          createLink('execution', 'data', 'data type'),
          createLink('execution', 'reminder', 'reminder type'),
          createLink('data', 'crm', 'sync'),
          createLink('message', 'crm', 'log')
        ]
      };

    case 'testing':
      return {
        nodeDataArray: [
          createNode('admin', 'Admin Console\nInterface', '#E3F2FD'),
          createNode('test-runner', 'Test Runner\nComponent', '#F3E5F5'),
          createNode('workflow-test', 'test-workflow-prompt\nFunction', '#E8F5E8'),
          createNode('ai-providers', 'AI Providers\n(OpenAI/Claude)', '#FFF3E0'),
          createNode('tools', 'MCP Tools\nExecution', '#FCE4EC'),
          createNode('results', 'Test Results\nDisplay', '#E0F2F1'),
          createNode('database', 'Database\nLogging', '#F1F8E9'),
          createNode('feedback', 'Feedback\nSystem', '#FFF8E1')
        ],
        linkDataArray: [
          createLink('admin', 'test-runner', 'user input'),
          createLink('test-runner', 'workflow-test', 'execute test'),
          createLink('workflow-test', 'ai-providers', 'AI request'),
          createLink('workflow-test', 'tools', 'tool calls'),
          createLink('tools', 'database', 'log actions'),
          createLink('workflow-test', 'results', 'response'),
          createLink('results', 'feedback', 'user rating'),
          createLink('feedback', 'database', 'store feedback')
        ]
      };

    default:
      return { 
        nodeDataArray: [], 
        linkDataArray: [] 
      };
  }
}

export default SystemDiagramCanvas;
