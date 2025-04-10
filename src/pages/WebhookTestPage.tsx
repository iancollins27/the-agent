
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { testWebhookWithJson, testWebhookWithFormData, testWebhookWithRawContent } from "@/utils/webhookTester";
import { Loader2 } from "lucide-react";

export default function WebhookTestPage() {
  const [activeTab, setActiveTab] = useState("json");
  const [jsonInput, setJsonInput] = useState('{\n  "name": "Test Webhook",\n  "description": "Testing webhook functionality"\n}');
  const [formInput, setFormInput] = useState('name=Test+Webhook&description=Testing+webhook+functionality');
  const [rawInput, setRawInput] = useState('Raw content for testing');
  const [contentType, setContentType] = useState('text/plain');
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleTestJson = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let jsonData;
      try {
        jsonData = JSON.parse(jsonInput);
      } catch (parseError) {
        throw new Error(`Invalid JSON: ${parseError.message}`);
      }
      
      const result = await testWebhookWithJson(jsonData);
      setResult(result);
    } catch (error: any) {
      console.error("JSON test failed:", error);
      setError(error.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTestForm = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Parse the form input into key-value pairs
      const formData: Record<string, string> = {};
      formInput.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          formData[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
        }
      });
      
      const result = await testWebhookWithFormData(formData);
      setResult(result);
    } catch (error: any) {
      console.error("Form test failed:", error);
      setError(error.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTestRaw = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await testWebhookWithRawContent(rawInput, contentType);
      setResult(result);
    } catch (error: any) {
      console.error("Raw test failed:", error);
      setError(error.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Webhook Testing Tool</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Test Webhook</CardTitle>
            <CardDescription>
              Send test webhooks with different content types to diagnose issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="form">Form URL Encoded</TabsTrigger>
                <TabsTrigger value="raw">Raw Content</TabsTrigger>
              </TabsList>
              
              <TabsContent value="json" className="space-y-4">
                <Textarea 
                  placeholder="Enter JSON payload" 
                  className="min-h-[200px] font-mono"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
                <Button 
                  onClick={handleTestJson} 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : 'Test JSON Webhook'}
                </Button>
              </TabsContent>
              
              <TabsContent value="form" className="space-y-4">
                <Textarea 
                  placeholder="Enter form data (key1=value1&key2=value2)" 
                  className="min-h-[200px] font-mono"
                  value={formInput}
                  onChange={(e) => setFormInput(e.target.value)}
                />
                <Button 
                  onClick={handleTestForm} 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : 'Test Form Webhook'}
                </Button>
              </TabsContent>
              
              <TabsContent value="raw" className="space-y-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Content Type</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-md px-3 py-2" 
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    placeholder="e.g., text/plain, application/xml"
                  />
                </div>
                <Textarea 
                  placeholder="Enter raw content" 
                  className="min-h-[200px] font-mono"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
                <Button 
                  onClick={handleTestRaw} 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : 'Test Raw Webhook'}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              View the response from the webhook endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                <h3 className="font-medium">Error</h3>
                <p className="mt-1">{error}</p>
              </div>
            ) : result ? (
              <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-[400px]">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-md text-center text-gray-500">
                No test run yet. Click one of the test buttons to see results.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
