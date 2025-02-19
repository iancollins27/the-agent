
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Circle } from "lucide-react";

export const ProjectTimeline = () => {
  const milestones = [
    {
      id: 1,
      title: "Project Initiation",
      date: "March 15, 2024",
      status: "completed",
      description: "Initial consultation and requirements gathering"
    },
    {
      id: 2,
      title: "Design Approval",
      date: "March 25, 2024",
      status: "completed",
      description: "Customer approved final design and equipment list"
    },
    {
      id: 3,
      title: "Installation",
      date: "April 2, 2024",
      status: "upcoming",
      description: "Full system installation and setup"
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <Circle className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <ScrollArea className="h-[250px]">
      <div className="relative space-y-4">
        {milestones.map((milestone, index) => (
          <div key={milestone.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              {getStatusIcon(milestone.status)}
              {index < milestones.length - 1 && (
                <div className="w-px h-full bg-border" />
              )}
            </div>
            
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium">{milestone.title}</h4>
                <Badge variant="outline" className="text-xs">
                  {milestone.date}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {milestone.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
