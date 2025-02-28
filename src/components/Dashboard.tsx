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
    <div className="flex flex-col gap-4 p-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Project Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectSummary />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Communication Log</CardTitle>
          </CardHeader>
          <CardContent>
            <CommunicationLog />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Action Center</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionCenter />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectTimeline />
        </CardContent>
      </Card>
    </div>
  );
};
