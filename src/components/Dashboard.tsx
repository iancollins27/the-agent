
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectSummary } from "./ProjectSummary";
import { ActionCenter } from "./ActionCenter";
import { CommunicationLog } from "./CommunicationLog";
import { ProjectTimeline } from "./ProjectTimeline";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

export const Dashboard = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Project Manager</h1>
          <p className="text-muted-foreground">Intelligent project oversight and management</p>
        </div>
        <Button variant="ghost" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
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
