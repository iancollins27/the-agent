
import React from 'react';

interface DataUpdateActionProps {
  field: string;
  value: string;
  description?: string;
}

const DataUpdateAction: React.FC<DataUpdateActionProps> = ({ field, value, description }) => {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Field</div>
          <div className="font-medium">{field}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Value</div>
          <div className="font-medium">{value}</div>
        </div>
      </div>
      {description && (
        <div>
          <div className="text-xs text-muted-foreground">Description</div>
          <div>{description}</div>
        </div>
      )}
    </div>
  );
};

export default DataUpdateAction;
