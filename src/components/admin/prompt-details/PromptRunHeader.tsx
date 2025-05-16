
import React, { useState, useEffect } from 'react';
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Users } from "lucide-react";
import { PromptRun } from '../types';
import { supabase } from '@/integrations/supabase/client';

interface Contact {
  id: string;
  full_name: string;
  role: string;
  email?: string;
  phone_number?: string;
}

interface PromptRunHeaderProps {
  promptRun: PromptRun;
  handleRerunPrompt: () => void;
  isRerunning: boolean;
}

const PromptRunHeader: React.FC<PromptRunHeaderProps> = ({ 
  promptRun, 
  handleRerunPrompt,
  isRerunning 
}) => {
  const [projectContacts, setProjectContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  useEffect(() => {
    const fetchProjectContacts = async () => {
      if (!promptRun.project_id) return;
      
      setIsLoadingContacts(true);
      try {
        // Query project_contacts to get contact IDs for this project
        const { data: contactsRel, error: contactsRelError } = await supabase
          .from('project_contacts')
          .select('contact_id')
          .eq('project_id', promptRun.project_id);

        if (contactsRelError || !contactsRel || contactsRel.length === 0) {
          setProjectContacts([]);
          return;
        }

        // Get the contact IDs
        const contactIds = contactsRel.map(item => item.contact_id);

        // Fetch the actual contact details
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, full_name, role, email, phone_number')
          .in('id', contactIds);

        if (contactsError) {
          console.error('Error fetching contacts:', contactsError);
          return;
        }

        setProjectContacts(contacts || []);
      } catch (error) {
        console.error('Error in fetchProjectContacts:', error);
      } finally {
        setIsLoadingContacts(false);
      }
    };

    fetchProjectContacts();
  }, [promptRun.project_id]);

  return (
    <DialogHeader className="flex flex-col space-y-2">
      <div className="flex flex-row items-center justify-between">
        <div>
          <DialogTitle>Prompt Run Details</DialogTitle>
          <DialogDescription>
            Created at {new Date(promptRun.created_at).toLocaleString()}
          </DialogDescription>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRerunPrompt}
            disabled={isRerunning}
            className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRerunning ? 'animate-spin' : ''}`} />
            {isRerunning ? "Running..." : "Re-run"}
          </Button>
          
          {promptRun.project_crm_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(promptRun.project_crm_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              CRM Record
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2 text-sm flex flex-wrap items-center gap-2">
        {promptRun.project_address && (
          <Badge variant="outline" className="font-normal">
            {promptRun.project_address}
          </Badge>
        )}
        <Badge variant="secondary" className="font-mono text-xs">
          ID: {promptRun.id}
        </Badge>
      </div>
      
      {/* Project Contacts Section */}
      {promptRun.project_id && (
        <div className="mt-2">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>Project Contacts:</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {isLoadingContacts ? (
              <span className="text-xs text-muted-foreground">Loading contacts...</span>
            ) : projectContacts.length > 0 ? (
              projectContacts.map((contact) => (
                <Badge 
                  key={contact.id} 
                  variant="outline" 
                  className="text-xs font-normal"
                >
                  {contact.full_name} ({contact.role})
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No contacts associated with this project</span>
            )}
          </div>
        </div>
      )}
    </DialogHeader>
  );
};

export default PromptRunHeader;
