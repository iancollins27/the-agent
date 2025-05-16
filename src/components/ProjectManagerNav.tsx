
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  Users 
} from "lucide-react";
import UserMenu from './UserMenu';

const ProjectManagerNav: React.FC = () => {
  return (
    <div className="flex justify-between items-center p-4 bg-white border-b">
      <div className="flex space-x-2">
        <Button variant="ghost" asChild>
          <Link to="/admin">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Admin
          </Link>
        </Button>
        
        <Button variant="ghost" asChild>
          <Link to="/project-manager">
            <Users className="h-4 w-4 mr-2" />
            Project Manager
          </Link>
        </Button>
        
        <Button variant="ghost" asChild>
          <Link to="/chat">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Link>
        </Button>
        
        <Button variant="ghost" asChild>
          <Link to="/company-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Link>
        </Button>
      </div>
      
      <div>
        <UserMenu />
      </div>
    </div>
  );
};

export default ProjectManagerNav;
