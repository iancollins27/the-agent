
import React from 'react';
import { MapPin } from "lucide-react";

interface DataUpdateActionProps {
  field: string;
  value: string;
  description: string;
}

const DataUpdateAction: React.FC<DataUpdateActionProps> = ({ field, value, description }) => {
  return (
    <>
      <p className="text-sm text-muted-foreground mb-1">
        <span className="font-medium">Field:</span> {field}
      </p>
      <p className="text-sm text-muted-foreground mb-1">
        <span className="font-medium">New Value:</span> {value}
      </p>
      {field === 'Address' && (
        <div className="flex items-start mt-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
          <span>{value}</span>
        </div>
      )}
      <p className="text-sm mt-2 p-3 bg-muted rounded-md">
        {description}
      </p>
    </>
  );
};

export default DataUpdateAction;
