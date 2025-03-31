
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export const CommunicationLog = () => {
  const communications = [
    {
      id: 1,
      type: "outbound",
      message: "Installation date confirmed for April 2nd, 2024.",
      timestamp: "10:30 AM",
      sender: "AI PM",
      recipient: "Customer"
    },
    {
      id: 2,
      type: "inbound",
      message: "Great, thank you for confirming. What time should I expect the team?",
      timestamp: "10:35 AM",
      sender: "Customer",
      recipient: "AI PM"
    },
    {
      id: 3,
      type: "outbound",
      message: "The installation team will arrive between 8:00 AM and 9:00 AM.",
      timestamp: "10:37 AM",
      sender: "AI PM",
      recipient: "Customer"
    }
  ];

  return (
    <ScrollArea className="h-[250px]">
      <div className="space-y-4">
        {communications.map((comm) => (
          <div
            key={comm.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              comm.type === "inbound" ? "bg-blue-50" : "bg-green-50"
            }`}
          >
            <div className="mt-1">
              {comm.type === "inbound" ? (
                <ArrowDownLeft className="w-4 h-4 text-blue-600" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              )}
            </div>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {comm.type === "inbound" ? "From" : "To"}: {comm.type === "inbound" ? comm.sender : comm.recipient}
                </Badge>
                <span className="text-xs text-muted-foreground">{comm.timestamp}</span>
              </div>
              <p className="text-sm">{comm.message}</p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
