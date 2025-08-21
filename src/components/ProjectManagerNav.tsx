
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
    <div className="flex justify-between items-center p-3 md:p-4 bg-white border-b">
      <div className="flex space-x-1 md:space-x-2 overflow-x-auto">
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link to="/admin">
            <LayoutDashboard className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </Button>
        
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link to="/project-manager">
            <Users className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Project Manager</span>
            <span className="sm:hidden">PM</span>
          </Link>
        </Button>
        
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link to="/chat">
            <MessageSquare className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Chat</span>
          </Link>
        </Button>
        
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link to="/company-settings">
            <Settings className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </Button>
      </div>
      
      <div className="shrink-0">
        <UserMenu />
      </div>
    </div>
  );
};

export default ProjectManagerNav;
