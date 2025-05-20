
import React from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MessageSenderProps {
  rooferName: string;
  projectIds: string[];
  message: string;
}

export const useMessageSender = ({ rooferName, projectIds, message }: MessageSenderProps) => {
  const { toast } = useToast();
  
  const sendMessage = async () => {
    if (!message.trim()) {
      toast({
        variant: "destructive",
        title: "Cannot send empty message",
        description: "Please generate or write a message before sending.",
      });
      return;
    }

    try {
      // Call the edge function to send the consolidated message
      const { data, error } = await supabase.functions.invoke('send-multi-project-message', {
        body: { 
          message: message,
          rooferName: rooferName,
          projectIds: projectIds
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Message sent",
        description: `Message successfully sent to ${rooferName}.`,
      });
      
      return true;
    } catch (error) {
      console.error('Error sending multi-project message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
      return false;
    }
  };

  return { sendMessage };
};
