
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { ToolConfigCardProps } from './types';

/**
 * Card component for configuring a single tool
 */
const ToolConfigCard: React.FC<ToolConfigCardProps> = ({ 
  name, 
  title, 
  description, 
  enabled, 
  onToggle,
  required = false,
  disabled = false,
  disabledReason
}) => {
  return (
    <Card className={`overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
      <CardContent className="p-0">
        <div className="flex items-start p-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium">{title}</h3>
              {required && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Required
                </span>
              )}
              {disabled && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
            {disabledReason && (
              <p className="text-xs text-amber-600 mt-1">{disabledReason}</p>
            )}
          </div>
          <div className="ml-4 flex items-center space-x-2">
            <Switch
              id={`toggle-${name}`}
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={required || disabled}
            />
            <Label htmlFor={`toggle-${name}`} className="sr-only">
              Enable {title}
            </Label>
            {enabled ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ToolConfigCard;
