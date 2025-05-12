
import React from 'react';
import { FileText } from "lucide-react";

interface NotionActionProps {
  databaseId: string;
  pageId?: string;
  description?: string;
}

const NotionAction: React.FC<NotionActionProps> = ({ databaseId, pageId, description }) => {
  return (
    <div className="space-y-2">
      {description && (
        <p className="text-sm p-3 bg-muted rounded-md">{description}</p>
      )}
      <div className="flex items-center gap-2 text-sm text-purple-700 p-2 bg-purple-50 rounded-md">
        <FileText className="h-4 w-4" />
        <span>
          {pageId ? "Update Notion page" : "Create Notion page"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="font-medium">Database ID:</div>
        <div className="truncate">{databaseId}</div>
        {pageId && (
          <>
            <div className="font-medium">Page ID:</div>
            <div className="truncate">{pageId}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotionAction;
