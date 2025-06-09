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
        if (currentScale < 3) {
          diagram.scale = Math.min(currentScale * 1.2, 3);
        }
      }
    },
    zoomOut: () => {
      if (diagram) {
        const currentScale = diagram.scale;
        if (currentScale > 0.1) {
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
        }) as string;
        
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

    let myDiagram: go.Diagram;
    
    try {
      myDiagram = $(go.Diagram, diagramRef.current, {
        'undoManager.isEnabled': true,
        layout: diagramType === 'high-level-architecture' ? 
          $(go.LayeredDigraphLayout, {
            direction: 0,
            layerSpacing: 120,
            columnSpacing: 60
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
          maxSize: new go.Size(140, NaN)
        }, new go.Binding('text', 'text'))
      );

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

      const modelData = getModelData(diagramType);
      
      if (modelData && modelData.nodeDataArray && modelData.linkDataArray) {
        myDiagram.model = new go.GraphLinksModel(modelData.nodeDataArray, modelData.linkDataArray);
      } else {
        myDiagram.model = new go.GraphLinksModel([], []);
      }

      setDiagram(myDiagram);
    } catch (error) {
      console.error('Error initializing GoJS diagram:', error);
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
  const createNode = (key: string, text: string, color: string, description?: string, edgeFunctions?: string[], fileReferences?: string[]) => ({
    key,
    text: text || 'Unnamed',
    color: color || '#E3F2FD',
    description: description || '',
    edgeFunctions: edgeFunctions || [],
    fileReferences: fileReferences || []
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
          // Proactive Orchestrator
          createNode('proactive-orchestrator', 'Proactive Background\nOrchestrator', '#FF6B6B', 
            'Monitors projects in background, detects needed actions, and schedules reminders', 
            ['check-project-reminders'], 
            ['supabase/functions/check-project-reminders/index.ts']),
          
          createNode('project-monitor', 'Project\nMonitoring', '#FFE66D',
            'Continuously monitors project status and milestones',
            ['check-project-reminders'],
            ['supabase/functions/check-project-reminders/index.ts']),
          
          createNode('workflow-engine', 'Workflow\nEngine', '#FFE66D',
            'Executes AI-driven workflow prompts and business logic',
            ['test-workflow-prompt'],
            ['supabase/functions/test-workflow-prompt/index.ts']),
          
          createNode('action-detection', 'Action\nDetection', '#FFE66D',
            'AI-powered detection of required actions from project data',
            ['test-workflow-prompt'],
            ['supabase/functions/test-workflow-prompt/index.ts']),
          
          createNode('reminder-system', 'Self-Reminder\nSystem', '#FFE66D',
            'Schedules and manages automated project reminders',
            ['check-project-reminders'],
            ['supabase/functions/check-project-reminders/index.ts']),
          
          // Interactive Chat Orchestrator
          createNode('chat-orchestrator', 'Interactive Chat\nOrchestrator', '#4ECDC4',
            'Handles real-time multi-channel communications and customer interactions',
            ['agent-chat'],
            ['supabase/functions/agent-chat/index.ts']),
          
          createNode('inbound-handler', 'Inbound Message\nHandler', '#95E1D3',
            'Processes incoming messages from all communication channels',
            ['comms-webhook-twilio', 'comms-webhook-justcall', 'chat-webhook-twilio'],
            ['supabase/functions/comms-webhook-twilio/index.ts', 'supabase/functions/chat-webhook-twilio/index.ts']),
          
          createNode('outbound-handler', 'Outbound Message\nHandler', '#95E1D3',
            'Sends responses and notifications through appropriate channels',
            ['send-communication', 'send-channel-message'],
            ['supabase/functions/send-communication/index.ts', 'supabase/functions/send-channel-message/index.ts']),
          
          createNode('sms-handler', 'SMS Channel\nProcessor', '#B8E6B8',
            'Dedicated SMS message processing and routing',
            ['comms-webhook-twilio', 'chat-webhook-twilio'],
            ['supabase/functions/comms-webhook-twilio/index.ts', 'supabase/functions/chat-webhook-twilio/index.ts']),
          
          createNode('email-handler', 'Email Channel\nProcessor', '#B8E6B8',
            'Email message processing and routing',
            ['comms-webhook-normalizer'],
            ['supabase/functions/comms-webhook-normalizer/index.ts']),
          
          createNode('support-agent', 'AI Support Agent\nInterface', '#95E1D3',
            'AI-powered customer support and assistance',
            ['agent-chat'],
            ['supabase/functions/agent-chat/index.ts']),

          // Shared Tools Section
          createNode('shared-tools', 'Shared Tools\nInfrastructure', '#DDA0DD',
            'Common tools and utilities used by both orchestrators',
            [],
            []),
          
          // Data Reading Tools
          createNode('read-crm-tool', 'Read CRM Data\nTool', '#E6E6FA',
            'Retrieves comprehensive project and contact data from CRM systems',
            ['test-workflow-prompt'],
            ['supabase/functions/test-workflow-prompt/tools/read-crm-data/index.ts']),
          
          createNode('read-comms-tool', 'Communication Logs\nReader', '#E6E6FA',
            'Accesses historical SMS, email, and call communication logs',
            ['test-workflow-prompt'],
            ['supabase/functions/test-workflow-prompt/database/index.ts']),
          
          // Action Tools
          createNode('create-action-tool', 'Create Action Record\nTool', '#FFE4E1',
            'Creates and manages action records for workflow execution',
            ['test-workflow-prompt'],
            ['supabase/functions/test-workflow-prompt/tools/create-action-record/index.ts']),
          
          // Core Infrastructure
          createNode('database', 'Database\n(Projects, Actions)', '#A8E6CF',
            'Central data storage for projects, actions, communications, and contacts',
            [],
            ['Database tables and functions']),
          
          createNode('ai-engine', 'AI Processing\nEngine', '#A8E6CF',
            'OpenAI and Claude integration for intelligent processing',
            ['test-workflow-prompt', 'agent-chat'],
            ['supabase/functions/test-workflow-prompt/ai-providers.ts']),
          
          createNode('integrations', 'External\nIntegrations', '#A8E6CF',
            'CRM, communication provider, and third-party system integrations',
            ['data-fetch', 'data-push'],
            ['supabase/functions/data-fetch/index.ts', 'supabase/functions/data-push/index.ts']),
          
          createNode('multi-company', 'Multi-Company\nSupport', '#A8E6CF',
            'Tenant isolation and multi-company data management',
            [],
            ['Database RLS policies and company filtering'])
        ],
        linkDataArray: [
          // Proactive orchestrator connections
          createLink('proactive-orchestrator', 'project-monitor', 'monitors'),
          createLink('proactive-orchestrator', 'workflow-engine', 'executes'),
          createLink('proactive-orchestrator', 'action-detection', 'detects'),
          createLink('proactive-orchestrator', 'reminder-system', 'schedules'),
          
          // Chat orchestrator connections
          createLink('chat-orchestrator', 'inbound-handler', 'routes'),
          createLink('chat-orchestrator', 'outbound-handler', 'sends'),
          createLink('inbound-handler', 'sms-handler', 'SMS'),
          createLink('inbound-handler', 'email-handler', 'Email'),
          createLink('outbound-handler', 'sms-handler', 'SMS'),
          createLink('outbound-handler', 'email-handler', 'Email'),
          createLink('chat-orchestrator', 'support-agent', 'AI assist'),
          
          // Shared tools connections
          createLink('proactive-orchestrator', 'shared-tools', 'uses'),
          createLink('chat-orchestrator', 'shared-tools', 'uses'),
          createLink('shared-tools', 'read-crm-tool', ''),
          createLink('shared-tools', 'read-comms-tool', ''),
          createLink('shared-tools', 'create-action-tool', ''),
          
          // Infrastructure connections
          createLink('shared-tools', 'database', 'stores/reads'),
          createLink('shared-tools', 'ai-engine', 'processes'),
          createLink('proactive-orchestrator', 'database', 'reads/writes'),
          createLink('chat-orchestrator', 'database', 'reads/writes'),
          createLink('workflow-engine', 'ai-engine', 'AI calls'),
          createLink('support-agent', 'ai-engine', 'AI calls'),
          createLink('database', 'integrations', 'syncs'),
          createLink('database', 'multi-company', 'isolates'),
          
          // Cross-communication
          createLink('chat-orchestrator', 'proactive-orchestrator', 'triggers'),
          createLink('proactive-orchestrator', 'chat-orchestrator', 'initiates'),
          
          // Tool usage
          createLink('workflow-engine', 'read-crm-tool', 'reads data'),
          createLink('workflow-engine', 'create-action-tool', 'creates actions'),
          createLink('support-agent', 'read-crm-tool', 'reads data'),
          createLink('support-agent', 'read-comms-tool', 'reads history')
        ]
      };

    case 'sms-chat':
      return {
        nodeDataArray: [
          createNode('twilio', 'Twilio SMS\nWebhook', '#E3F2FD',
            'External Twilio webhook endpoint for incoming SMS messages',
            [],
            ['Twilio webhook configuration']),
          
          createNode('webhook', 'chat-webhook-twilio', '#F3E5F5',
            'Processes incoming SMS webhooks and creates chat sessions',
            ['chat-webhook-twilio'],
            ['supabase/functions/chat-webhook-twilio/index.ts']),
          
          createNode('session', 'Chat Session\nManager', '#E8F5E8',
            'Manages conversation state and message history',
            ['chat-session-manager'],
            ['supabase/functions/chat-session-manager/index.ts']),
          
          createNode('agent', 'agent-chat\nFunction', '#FFF3E0',
            'AI-powered chat agent with tool access and context awareness',
            ['agent-chat'],
            ['supabase/functions/agent-chat/index.ts']),
          
          createNode('tools', 'Available Tools\n(channel_response)', '#FCE4EC',
            'Tools available to AI agent including response generation',
            ['agent-chat'],
            ['supabase/functions/agent-chat/tools/']),
          
          createNode('response', 'send-channel-message', '#E0F2F1',
            'Handles channel-specific message sending logic',
            ['send-channel-message'],
            ['supabase/functions/send-channel-message/index.ts']),
          
          createNode('send-comm', 'send-communication', '#F1F8E9',
            'Core communication sending with provider selection',
            ['send-communication'],
            ['supabase/functions/send-communication/index.ts']),
          
          createNode('twilio-send', 'Twilio API\nSend SMS', '#FFF8E1',
            'External Twilio API for sending SMS responses',
            [],
            ['Twilio SMS API integration'])
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
