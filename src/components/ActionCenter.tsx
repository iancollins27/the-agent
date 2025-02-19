
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, AlertTriangle } from "lucide-react";

export const ActionCenter = () => {
  const actions = [
    {
      id: 1,
      title: "Schedule Installation",
      status: "pending",
      priority: "high",
      description: "Contact customer to confirm installation date for 4/2"
    },
    {
      id: 2,
      title: "Equipment Verification",
      status: "completed",
      priority: "medium",
      description: "Verify all equipment has been ordered and delivery dates confirmed"
    },
    {
      id: 3,
      title: "Follow-up Required",
      status: "pending",
      priority: "low",
      description: "Send installation preparation checklist to customer"
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

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[250px]">
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="p-3 rounded-lg border bg-card transition-all hover:shadow-sm"
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
    </div>
  );
};
