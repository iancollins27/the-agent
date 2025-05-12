
import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface MessageActionProps {
  recipient: string;
  recipient_id?: string;
  messageContent: string;
  description?: string;
  sender?: string;
  sender_ID?: string;
}

const MessageAction: React.FC<MessageActionProps> = ({ 
  recipient, 
  recipient_id,
  messageContent, 
  description,
  sender,
  sender_ID 
}) => {
  const [recipientName, setRecipientName] = useState<string>(recipient || 'Unknown recipient');
  const [senderName, setSenderName] = useState<string>(sender || 'Unknown sender');

  // Fetch contact names if IDs are provided
  useEffect(() => {
    const fetchContactNames = async () => {
      // Fetch recipient name if ID is provided
      if (recipient_id) {
        try {
          const { data: contactData, error } = await supabase
            .from('contacts')
            .select('full_name, role')
            .eq('id', recipient_id)
            .single();

          if (!error && contactData) {
            setRecipientName(`${contactData.full_name}${contactData.role ? ` (${contactData.role})` : ''}`);
          }
        } catch (error) {
          console.error("Error fetching recipient data:", error);
        }
      }

      // Fetch sender name if ID is provided
      if (sender_ID) {
        try {
          const { data: contactData, error } = await supabase
            .from('contacts')
            .select('full_name, role')
            .eq('id', sender_ID)
            .single();

          if (!error && contactData) {
            setSenderName(`${contactData.full_name}${contactData.role ? ` (${contactData.role})` : ''}`);
          }
        } catch (error) {
          console.error("Error fetching sender data:", error);
        }
      }
    };

    fetchContactNames();
  }, [recipient_id, sender_ID]);

  return (
    <div className="space-y-2">
      {sender && (
        <div>
          <div className="text-xs text-muted-foreground">From</div>
          <div className="font-medium">{senderName}</div>
        </div>
      )}
      <div>
        <div className="text-xs text-muted-foreground">To</div>
        <div className="font-medium">{recipientName}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Message</div>
        <div className="bg-muted p-2 rounded-md text-sm whitespace-pre-wrap">{messageContent}</div>
      </div>
      {description && (
        <div>
          <div className="text-xs text-muted-foreground">Description</div>
          <div>{description}</div>
        </div>
      )}
    </div>
  );
};

export default MessageAction;
