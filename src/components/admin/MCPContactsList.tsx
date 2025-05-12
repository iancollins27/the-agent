
import { useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Contact {
  id: string;
  full_name: string;
  role: string;
  email?: string;
  phone_number?: string;
}

interface MCPContactsListProps {
  contacts: Contact[] | null;
  isLoading?: boolean;
}

const MCPContactsList = ({ contacts, isLoading = false }: MCPContactsListProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="mb-4 overflow-hidden">
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="w-full"
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex justify-between items-center p-3 hover:bg-muted/50 rounded-none text-left font-medium"
          >
            <div className="flex items-center gap-2">
              <Users size={16} />
              <span>Project Contacts</span>
              <span className="bg-muted text-muted-foreground text-xs py-0.5 px-1.5 rounded-md">
                {contacts ? contacts.length : 0}
              </span>
            </div>
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="p-3 border-t">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading contacts...</div>
          ) : !contacts || contacts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No contacts available for this project.</div>
          ) : (
            <div className="space-y-3">
              {contacts.map(contact => (
                <div key={contact.id} className="text-sm border rounded-md p-2">
                  <div className="font-medium">{contact.full_name}</div>
                  <div className="text-xs text-muted-foreground">Role: {contact.role}</div>
                  {contact.email && (
                    <div className="text-xs text-muted-foreground">Email: {contact.email}</div>
                  )}
                  {contact.phone_number && (
                    <div className="text-xs text-muted-foreground">Phone: {contact.phone_number}</div>
                  )}
                  <div className="text-xs mt-1 bg-muted/50 px-2 py-1 rounded inline-flex items-center text-muted-foreground">
                    ID: {contact.id}
                  </div>
                </div>
              ))}
              
              <div className="text-xs bg-muted/50 p-2 rounded">
                <p className="font-medium mb-1">Using Project Contacts in Prompts</p>
                <p>Add <code className="bg-muted px-1 py-0.5 rounded">{'{{project_contacts}}'}</code> to your MCP orchestrator prompt to include this contacts list.</p>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default MCPContactsList;
