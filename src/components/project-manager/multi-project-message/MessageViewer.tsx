
import React from 'react';
import { Button } from "@/components/ui/button";
import { Eye, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface MessageViewerProps {
  rooferName: string;
  message: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
}

const MessageViewer: React.FC<MessageViewerProps> = ({ 
  rooferName, 
  message,
  onMessageChange,
  onSendMessage
}) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <>
      <Button 
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="flex items-center"
      >
        <Eye className="mr-1 h-4 w-4" />
        View Multi-Project Message
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Multi-Project Message to {rooferName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Textarea 
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Message content..."
              className="min-h-[300px]"
            />
          </div>
          
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onSendMessage();
                setDialogOpen(false);
              }} 
              className="flex items-center"
            >
              <Send className="mr-1 h-4 w-4" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MessageViewer;
