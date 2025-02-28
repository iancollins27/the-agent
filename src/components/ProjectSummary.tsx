
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export const ProjectSummary = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project: Smart Home Installation</h3>
          <p className="text-sm text-muted-foreground">Last updated: 2 hours ago</p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">Active</Badge>
      </div>
      
      <ScrollArea className="h-[200px] rounded-md border p-4">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            Current project phase: Installation Planning
            Customer has approved the initial design and timeline.
            Waiting for equipment delivery confirmation.
            Next steps include scheduling the installation team and confirming the installation date with the customer.
          </p>
          
          <div className="space-y-2">
            <h4 className="font-medium">Key Points:</h4>
            <ul className="text-sm space-y-1 list-disc pl-4">
              <li>Budget: On track</li>
              <li>Timeline: Within schedule</li>
              <li>Customer Satisfaction: High</li>
              <li>Risk Level: Low</li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
