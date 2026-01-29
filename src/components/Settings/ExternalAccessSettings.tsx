import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Copy, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ApiKey {
  id: string;
  key_name: string;
  enabled_tools: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

const AVAILABLE_TOOLS = [
  { id: 'crm_read', label: 'CRM Read', description: 'Read project and contact data' },
  { id: 'crm_write', label: 'CRM Write', description: 'Update project and contact data' },
];

async function generateApiKey(): Promise<{ key: string; hash: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const key = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return { key, hash };
}

const ExternalAccessSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['crm_read', 'crm_write']);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['mcp-access-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mcp_external_access_keys')
        .select('id, key_name, enabled_tools, is_active, created_at, last_used_at, expires_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ApiKey[];
    }
  });

  const createKeyMutation = useMutation({
    mutationFn: async ({ keyName, tools }: { keyName: string; tools: string[] }) => {
      const { key, hash } = await generateApiKey();
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (!profile?.company_id) {
        throw new Error('No company found for user');
      }

      const { error } = await supabase
        .from('mcp_external_access_keys')
        .insert({
          key_name: keyName,
          key_hash: hash,
          company_id: profile.company_id,
          enabled_tools: tools,
        });
      
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      setNewKeyValue(key);
      setShowCreateDialog(false);
      setShowNewKeyDialog(true);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['mcp-access-keys'] });
      toast({ title: "API key created successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to create API key", description: error.message, variant: "destructive" });
    }
  });

  const toggleKeyMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('mcp_external_access_keys')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-access-keys'] });
      toast({ title: "API key updated" });
    }
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mcp_external_access_keys')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-access-keys'] });
      setDeleteKeyId(null);
      toast({ title: "API key deleted" });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleToolToggle = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(t => t !== toolId)
        : [...prev, toolId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>External API Keys</CardTitle>
              <CardDescription>
                Manage API keys for external AI agents (Claude Desktop, Cursor, etc.) to access your tools via MCP.
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {keys && keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No API keys created yet.</p>
              <p className="text-sm mt-1">Create a key to allow external AI agents to access your tools.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {keys?.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.key_name}</span>
                      {!key.is_active && <Badge variant="secondary">Disabled</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {key.enabled_tools.map(tool => (
                        <Badge key={tool} variant="outline" className="text-xs">{tool}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && ` • Last used: ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${key.id}`} className="text-sm">Active</Label>
                      <Switch
                        id={`active-${key.id}`}
                        checked={key.is_active}
                        onCheckedChange={(checked) => toggleKeyMutation.mutate({ id: key.id, isActive: checked })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteKeyId(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCP Server Endpoint</CardTitle>
          <CardDescription>
            Use this URL to connect external AI agents to your tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-md text-sm font-mono">
              https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/mcp-tools-server
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard('https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/mcp-tools-server')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for external AI agent access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., Claude Desktop - Work Laptop"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Enabled Tools</Label>
              <div className="space-y-2">
                {AVAILABLE_TOOLS.map(tool => (
                  <div key={tool.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{tool.label}</p>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </div>
                    <Switch
                      checked={selectedTools.includes(tool.id)}
                      onCheckedChange={() => handleToolToggle(tool.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => createKeyMutation.mutate({ keyName: newKeyName, tools: selectedTools })}
              disabled={!newKeyName.trim() || selectedTools.length === 0 || createKeyMutation.isPending}
            >
              {createKeyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your New API Key</DialogTitle>
            <DialogDescription>
              Copy this key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This is the only time you'll see this key. Store it securely.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-md text-sm font-mono break-all">
              {showKey ? newKeyValue : '•'.repeat(32)}
            </code>
            <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(newKeyValue)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowNewKeyDialog(false); setNewKeyValue(''); setShowKey(false); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any external agents using this key will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyId && deleteKeyMutation.mutate(deleteKeyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExternalAccessSettings;
