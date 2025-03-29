
import React from 'react';

interface NotionActionProps {
  databaseId?: string;
  pageId?: string;
  description?: string;
}

const NotionAction: React.FC<NotionActionProps> = ({ databaseId, pageId, description }) => {
  return (
    <>
      <p className="text-sm text-muted-foreground mb-1">
        <span className="font-medium">Integration Type:</span> Notion
      </p>
      {databaseId && (
        <p className="text-sm text-muted-foreground mb-1">
          <span className="font-medium">Database ID:</span> {databaseId}
        </p>
      )}
      {pageId && (
        <p className="text-sm text-muted-foreground mb-1">
          <span className="font-medium">Page ID:</span> {pageId}
        </p>
      )}
      <div className="mt-2 p-3 bg-muted rounded-md">
        <p className="text-sm font-medium mb-1">Note:</p>
        <p className="text-sm">
          This will integrate with Notion and create vector embeddings for search functionality. 
          The API token will be securely stored.
        </p>
      </div>
      {description && (
        <p className="text-sm mt-2 p-3 bg-muted rounded-md">
          {description}
        </p>
      )}
    </>
  );
};

export default NotionAction;
