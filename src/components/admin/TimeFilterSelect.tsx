
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock } from 'lucide-react';

export const TIME_FILTERS = {
  LAST_HOUR: 'last_hour',
  LAST_24_HOURS: 'last_24_hours',
  LAST_7_DAYS: 'last_7_days',
  ALL: 'all'
};

interface TimeFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const TimeFilterSelect: React.FC<TimeFilterSelectProps> = ({ value, onChange }) => {
  // Ensure we have a valid default if value is undefined
  const currentValue = value || TIME_FILTERS.ALL;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Show:</span>
      <Select 
        value={currentValue} 
        onValueChange={onChange}
        defaultValue={TIME_FILTERS.ALL}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TIME_FILTERS.LAST_HOUR}>
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Last Hour
            </div>
          </SelectItem>
          <SelectItem value={TIME_FILTERS.LAST_24_HOURS}>Last 24 Hours</SelectItem>
          <SelectItem value={TIME_FILTERS.LAST_7_DAYS}>Last 7 Days</SelectItem>
          <SelectItem value={TIME_FILTERS.ALL}>All Time</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default TimeFilterSelect;
