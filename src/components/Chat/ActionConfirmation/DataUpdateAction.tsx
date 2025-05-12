
import React from 'react';

interface DataUpdateActionProps {
  field: string;
  value: string | number | boolean;
  description?: string;
}

const DataUpdateAction: React.FC<DataUpdateActionProps> = ({ field, value, description }) => {
  return (
    <div className="space-y-2">
      {description && (
        <p className="text-sm p-3 bg-muted rounded-md">{description}</p>
      )}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="font-medium">Field:</div>
        <div>{field}</div>
        <div className="font-medium">New Value:</div>
        <div className="break-words">{String(value)}</div>
      </div>
    </div>
  );
};

export default DataUpdateAction;
