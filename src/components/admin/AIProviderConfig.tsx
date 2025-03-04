
import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Anthropic Claude" },
  { value: "deepseek", label: "DeepSeek" }
];

const MODEL_OPTIONS = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" }
  ],
  claude: [
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" }
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat" },
    { value: "deepseek-coder", label: "DeepSeek Coder" }
  ]
};

const AIProviderConfig = () => {
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchCurrentConfig();
  }, []);
  
  const fetchCurrentConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_config")
        .select("provider, model")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
        console.error("Error fetching AI config:", error);
      } else if (data) {
        setSelectedProvider(data.provider || "openai");
        setSelectedModel(data.model || "gpt-4o");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setSelectedProvider(newProvider);
    // Set default model for the selected provider
    setSelectedModel(MODEL_OPTIONS[newProvider][0].value);
  };
  
  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("ai_config")
        .insert({
          provider: selectedProvider,
          model: selectedModel
        });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "AI Provider Updated",
        description: `Now using ${selectedProvider} with model ${selectedModel}`,
      });
    } catch (error) {
      console.error("Error saving AI config:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save AI provider configuration",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Provider Configuration</CardTitle>
        <CardDescription>
          Select which AI provider and model to use for all workflow prompts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="ai-provider">AI Provider</Label>
              <select
                id="ai-provider"
                value={selectedProvider}
                onChange={handleProviderChange}
                className="w-full border border-input bg-background px-3 py-2 rounded-md"
              >
                {PROVIDER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ai-model">AI Model</Label>
              <select
                id="ai-model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full border border-input bg-background px-3 py-2 rounded-md"
              >
                {MODEL_OPTIONS[selectedProvider]?.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                {selectedProvider === "openai" && (
                  "OpenAI models provide strong general capabilities with competitive pricing."
                )}
                {selectedProvider === "claude" && (
                  "Claude excels at complex reasoning and following nuanced instructions."
                )}
                {selectedProvider === "deepseek" && (
                  "DeepSeek offers specialized models optimized for code and technical content."
                )}
              </p>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={saveConfiguration} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AIProviderConfig;
