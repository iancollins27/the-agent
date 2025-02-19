
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectSummary } from "./ProjectSummary";
import { ActionCenter } from "./ActionCenter";
import { CommunicationLog } from "./CommunicationLog";
import { ProjectTimeline } from "./ProjectTimeline";

export const Dashboard = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">AI Project Manager</h1>
        <p className="text-muted-foreground">Intelligent project oversight and management</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="slide-in">
          <CardHeader>
            <CardTitle>Project Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectSummary />
          </CardContent>
        </Card>

        <Card className="slide-in">
          <CardHeader>
            <CardTitle>Action Center</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionCenter />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="slide-in">
          <CardHeader>
            <CardTitle>Communication Log</CardTitle>
          </CardHeader>
          <CardContent>
            <CommunicationLog />
          </CardContent>
        </Card>

        <Card className="slide-in">
          <CardHeader>
            <CardTitle>Project Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectTimeline />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
