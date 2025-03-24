
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

export const ActionCenter = () => {
  const [selectedAction, setSelectedAction] = useState<number | null>(null);
  const [actionMessages, setActionMessages] = useState<Record<number, string>>({
    1: "Contact customer to confirm installation date for 4/2",
    2: "Verify all equipment has been ordered and delivery dates confirmed",
    3: "Send installation preparation checklist to customer"
  });

  const actions = [
    {
      id: 1,
      title: "Schedule Installation",
      status: "pending",
      priority: "high",
      description: actionMessages[1]
    },
    {
      id: 2,
      title: "Equipment Verification",
      status: "completed",
      priority: "medium",
      description: actionMessages[2]
    },
    {
      id: 3,
      title: "Follow-up Required",
      status: "pending",
      priority: "low",
      description: actionMessages[3]
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="w-4 h-4 text-green-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: "text-rose-700 bg-rose-50",
      medium: "text-amber-700 bg-amber-50",
      low: "text-green-700 bg-green-50"
    };
    
    return (
      <Badge variant="outline" className={colors[priority as keyof typeof colors]}>
        {priority}
      </Badge>
    );
  };

  const handleEditMessage = (id: number, message: string) => {
    setActionMessages(prev => ({
      ...prev,
      [id]: message
    }));
  };

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[250px]">
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="p-3 rounded-lg border bg-card transition-all hover:shadow-sm cursor-pointer"
              onClick={() => setSelectedAction(action.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(action.status)}
                  <div>
                    <h4 className="font-medium text-sm">{action.title}</h4>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                {getPriorityBadge(action.priority)}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" size="sm">Refresh</Button>
        <Button size="sm">Take Action</Button>
      </div>

      {/* Action Edit Sheet */}
      <Sheet 
        open={selectedAction !== null} 
        onOpenChange={(open) => !open && setSelectedAction(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Edit Action
            </SheetTitle>
          </SheetHeader>
          
          {selectedAction && (
            <div className="py-4 space-y-4">
              <h3 className="font-medium">
                {actions.find(a => a.id === selectedAction)?.title}
              </h3>
              
              <Textarea 
                value={actionMessages[selectedAction]} 
                onChange={(e) => handleEditMessage(selectedAction, e.target.value)}
                placeholder="Enter action description" 
                className="min-h-[150px]"
              />
              
              <div className="flex justify-end">
                <Button onClick={() => setSelectedAction(null)}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
