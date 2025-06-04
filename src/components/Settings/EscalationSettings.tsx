
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/providers/SettingsProvider";

interface EscalationRecipient {
  id?: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email?: string;
  is_active: boolean;
  notification_types: string[];
}

const EscalationSettings: React.FC = () => {
  const [recipients, setRecipients] = useState<EscalationRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { companySettings } = useSettings();

  useEffect(() => {
    if (companySettings?.id) {
      fetchEscalationRecipients();
    }
  }, [companySettings?.id]);

  const fetchEscalationRecipients = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('escalation_config')
        .select('*')
        .eq('company_id', companySettings?.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching escalation recipients:', error);
        toast({
          title: "Error",
          description: "Failed to load escalation recipients",
          variant: "destructive",
        });
      } else {
        setRecipients(data || []);
      }
    } catch (error) {
      console.error('Error fetching escalation recipients:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addRecipient = () => {
    setRecipients([
      ...recipients,
      {
        recipient_name: '',
        recipient_phone: '',
        recipient_email: '',
        is_active: true,
        notification_types: ['escalation']
      }
    ]);
  };

  const updateRecipient = (index: number, field: keyof EscalationRecipient, value: any) => {
    const updatedRecipients = [...recipients];
    updatedRecipients[index] = {
      ...updatedRecipients[index],
      [field]: value
    };
    setRecipients(updatedRecipients);
  };

  const removeRecipient = async (index: number) => {
    const recipient = recipients[index];
    
    if (recipient.id) {
      try {
        const { error } = await supabase
          .from('escalation_config')
          .delete()
          .eq('id', recipient.id);

        if (error) {
          toast({
            title: "Error",
            description: "Failed to delete recipient",
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
        return;
      }
    }

    const updatedRecipients = recipients.filter((_, i) => i !== index);
    setRecipients(updatedRecipients);
    
    toast({
      title: "Success",
      description: "Recipient removed",
    });
  };

  const saveSettings = async () => {
    if (!companySettings?.id) {
      toast({
        title: "Error",
        description: "No company selected",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      // Validate recipients
      const validRecipients = recipients.filter(r => 
        r.recipient_name.trim() && r.recipient_phone.trim()
      );

      if (validRecipients.length !== recipients.length) {
        toast({
          title: "Validation Error",
          description: "Please fill in name and phone for all recipients",
          variant: "destructive",
        });
        return;
      }

      // Save each recipient
      for (const recipient of validRecipients) {
        if (recipient.id) {
          // Update existing
          const { error } = await supabase
            .from('escalation_config')
            .update({
              recipient_name: recipient.recipient_name,
              recipient_phone: recipient.recipient_phone,
              recipient_email: recipient.recipient_email || null,
              is_active: recipient.is_active,
              notification_types: recipient.notification_types,
              updated_at: new Date().toISOString()
            })
            .eq('id', recipient.id);

          if (error) {
            throw error;
          }
        } else {
          // Insert new
          const { error } = await supabase
            .from('escalation_config')
            .insert({
              company_id: companySettings.id,
              recipient_name: recipient.recipient_name,
              recipient_phone: recipient.recipient_phone,
              recipient_email: recipient.recipient_email || null,
              is_active: recipient.is_active,
              notification_types: recipient.notification_types
            });

          if (error) {
            throw error;
          }
        }
      }

      toast({
        title: "Success",
        description: "Escalation settings saved",
      });

      // Refresh the list
      await fetchEscalationRecipients();
    } catch (error) {
      console.error('Error saving escalation settings:', error);
      toast({
        title: "Error",
        description: "Failed to save escalation settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div>Loading escalation settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escalation Notifications</CardTitle>
        <CardDescription>
          Configure who receives SMS notifications when projects are escalated due to non-responsive contacts or critical issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {recipients.map((recipient, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Recipient {index + 1}</h4>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${index}`} className="text-sm">
                    Active
                  </Label>
                  <Switch
                    id={`active-${index}`}
                    checked={recipient.is_active}
                    onCheckedChange={(checked) => updateRecipient(index, 'is_active', checked)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeRecipient(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`name-${index}`}>Name *</Label>
                  <Input
                    id={`name-${index}`}
                    value={recipient.recipient_name}
                    onChange={(e) => updateRecipient(index, 'recipient_name', e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                
                <div>
                  <Label htmlFor={`phone-${index}`}>Phone Number *</Label>
                  <Input
                    id={`phone-${index}`}
                    value={recipient.recipient_phone}
                    onChange={(e) => updateRecipient(index, 'recipient_phone', e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor={`email-${index}`}>Email (Optional)</Label>
                  <Input
                    id={`email-${index}`}
                    type="email"
                    value={recipient.recipient_email || ''}
                    onChange={(e) => updateRecipient(index, 'recipient_email', e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={addRecipient}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Recipient
          </Button>
          
          <Button
            onClick={saveSettings}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">How Escalations Work</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• The AI will automatically detect when projects need escalation</li>
            <li>• Escalations are triggered for non-responsive contacts, overdue milestones, or critical issues</li>
            <li>• All active recipients will receive SMS notifications with project details</li>
            <li>• Escalations are executed immediately without requiring approval</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default EscalationSettings;
