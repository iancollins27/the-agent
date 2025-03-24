
import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MermaidDiagrams = () => {
  const [activeTab, setActiveTab] = useState('communications');

  // Initialize mermaid on first render
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      flowchart: { useMaxWidth: false }
    });
  }, []);

  // Re-run mermaid rendering when tab changes
  useEffect(() => {
    mermaid.run();
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">System Flow Diagrams</h1>
        <p className="text-muted-foreground">Visual representation of prompt workflows in the system</p>
      </header>

      <Tabs defaultValue="communications" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="communications">Communications Flow</TabsTrigger>
          <TabsTrigger value="actions">Actions Flow</TabsTrigger>
          <TabsTrigger value="testing">Testing Flow</TabsTrigger>
          <TabsTrigger value="agent-chat">Agent Chat Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="communications" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Communications Processing Flow</h2>
            <div className="mermaid">
              {`
              flowchart TD
                A[Communication Webhook] --> B[Webhook Normalizer]
                B --> C{Project Detection}
                C -->|Single Project| D[processCommunicationForProject]
                C -->|Multiple Projects| E[processMultiProjectMessages]
                D --> F[updateProjectWithAI]
                F --> G[Get summary_update Prompt]
                F --> H[Get action_detection_execution Prompt]
                G --> I[Call test-workflow-prompt]
                H --> J[Call test-workflow-prompt]
                I --> K[Update Project Summary]
                J --> L[Detect & Execute Actions]
                L -->|ActionRecord Created| M[(Database)]
              `}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Action Detection & Execution Flow</h2>
            <div className="mermaid">
              {`
              flowchart TD
                A[action_detection_execution Prompt] --> B[test-workflow-prompt Function]
                B --> C[Call AI Provider]
                C --> D[Process AI Response]
                D -->|Action Needed| E[createActionRecord]
                D -->|No Action| F[Return Result]
                E --> G{Action Type}
                G -->|data_update| H[Update Project Field]
                G -->|set_future_reminder| I[Set Next Check Date]
                G -->|message| J[Create Message Action]
                H & I & J --> K[Update Action Record Status]
                K --> L[(Database)]
              `}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Prompt Testing Flow</h2>
            <div className="mermaid">
              {`
              flowchart TD
                A[User Initiates Test] --> B[TestRunner Component]
                B --> C[test-workflow-prompt Function]
                C --> D[logPromptRun]
                D --> E[Call AI Provider]
                E --> F[Process Response]
                F --> G[updatePromptRunWithResult]
                F -->|Action Needed| H[createActionRecord]
                G & H --> I[Return Test Results]
                I --> J[TestResults Component]
                J --> K[Display Results to User]
              `}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="agent-chat" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Agent Chat Flow</h2>
            <div className="mermaid">
              {`
              flowchart TD
                A[User Message] --> B[agent-chat Function]
                B --> C[Get Chatbot Config]
                B --> D[Get AI Config]
                B --> E{Project Context}
                E -->|Project ID| F[Fetch Project Data]
                E -->|CRM ID| G[Search Projects by CRM ID]
                F & G --> H[Knowledge Base Check]
                H -->|Knowledge Query| I[Search Knowledge Base]
                B --> J[Detect Action Requests]
                C & D & F & G & I & J --> K[Build System Prompt]
                K --> L[Call AI Provider]
                L --> M[Process Response]
                M -->|Action JSON Detected| N[Create Action Record]
                M --> O[Return Response to User]
              `}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MermaidDiagrams;
