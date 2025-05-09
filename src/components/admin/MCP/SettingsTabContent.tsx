
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Content for the Settings tab in MCP configuration
 */
const SettingsTabContent: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Settings</CardTitle>
        <CardDescription>
          Configure how the MCP system operates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-medium">Default AI Provider</label>
            <select className="w-full mt-1 border rounded p-2">
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
            </select>
          </div>
          <div>
            <label className="font-medium">Default AI Model</label>
            <select className="w-full mt-1 border rounded p-2">
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button>Save Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsTabContent;
