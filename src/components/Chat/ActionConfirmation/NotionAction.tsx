
import React from 'react';

type NotionActionProps = {
  databaseId?: string;
  pageId?: string;
  description?: string;
};

const NotionAction: React.FC<NotionActionProps> = ({ description }) => {
  return (
    <div className="text-sm mt-2 p-3 bg-muted rounded-md">
      <p className="text-muted-foreground">
        {description || 'This feature has been deprecated.'}
      </p>
    </div>
  );
};

export default NotionAction;
