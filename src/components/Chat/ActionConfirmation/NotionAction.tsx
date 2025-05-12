
import React from 'react';

interface NotionActionProps {
  databaseId?: string;
  pageId?: string;
  description?: string;
}

const NotionAction: React.FC<NotionActionProps> = ({ databaseId, pageId, description }) => {
  return (
    <div className="space-y-2">
      {databaseId && (
        <div>
          <div className="text-xs text-muted-foreground">Database ID</div>
          <div className="font-medium">{databaseId}</div>
        </div>
      )}
      {pageId && (
        <div>
          <div className="text-xs text-muted-foreground">Page ID</div>
          <div className="font-medium">{pageId}</div>
        </div>
      )}
      {description && (
        <div>
          <div className="text-xs text-muted-foreground">Description</div>
          <div className="bg-muted p-2 rounded-md text-sm">{description}</div>
        </div>
      )}
    </div>
  );
};

export default NotionAction;
