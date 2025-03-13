
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ActionRecord } from './types';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { X, Save, Edit2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';

interface ActionRecordEditProps {
  record: ActionRecord;
  field: 'message' | 'recipient_name';
  onSuccess: () => void;
}

interface FormValues {
  value: string;
}

const ActionRecordEdit = ({ record, field, onSuccess }: ActionRecordEditProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    defaultValues: {
      value: field === 'message' 
        ? record.message || 
          (record.action_payload && typeof record.action_payload === 'object' && 'message' in record.action_payload 
            ? record.action_payload.message 
            : '')
        : record.recipient_name || ''
    }
  });

  const handleSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    
    try {
      let updateData: any = {};
      
      if (field === 'message') {
        updateData.message = data.value;
        
        // Also update in action_payload if it exists
        if (record.action_payload && typeof record.action_payload === 'object') {
          const updatedPayload = { ...record.action_payload, message: data.value };
          updateData.action_payload = updatedPayload;
        }
      } else if (field === 'recipient_name') {
        // For recipient, we can only update the display value since the actual
        // recipient ID is stored elsewhere - this is for display purposes
        // In a real implementation, you might need to update related tables
        
        // If the action_payload contains a recipient field, update it
        if (record.action_payload && typeof record.action_payload === 'object') {
          const updatedPayload = { ...record.action_payload, recipient: data.value };
          updateData.action_payload = updatedPayload;
        }
      }
      
      const { error } = await supabase
        .from('action_records')
        .update(updateData)
        .eq('id', record.id);
        
      if (error) throw error;
      
      toast({
        title: "Updated successfully",
        description: `The ${field === 'message' ? 'message' : 'recipient'} has been updated.`,
      });
      
      setIsOpen(false);
      onSuccess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="group relative cursor-pointer flex items-center">
          <span className="mr-2 truncate">
            {field === 'message' 
              ? (record.message || 
                (record.action_payload && typeof record.action_payload === 'object' && 'message' in record.action_payload 
                  ? record.action_payload.message 
                  : 'N/A'))
              : (record.recipient_name || 'No Recipient')}
          </span>
          <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              Edit {field === 'message' ? 'Message' : 'Recipient'}
            </h4>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {field === 'message' ? 'Message Content' : 'Recipient Name'}
                    </FormLabel>
                    <FormControl>
                      {field === 'message' ? (
                        <Textarea 
                          {...field} 
                          rows={4} 
                          placeholder="Enter message content" 
                        />
                      ) : (
                        <Input 
                          {...field} 
                          placeholder="Enter recipient name" 
                        />
                      )}
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  size="sm"
                >
                  {isSubmitting ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ActionRecordEdit;
