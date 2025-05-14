
import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface PromptRunFiltersProps {
  setFilter: (key: string, value: any) => void;
  reviewed: boolean;
  rating: number | null;
  hasError: boolean;
  search: string;
}

const PromptRunFilters: React.FC<PromptRunFiltersProps> = ({
  setFilter,
  reviewed,
  rating,
  hasError,
  search,
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-center">
      {/* Search filter */}
      <div className="relative w-full md:w-64">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="pl-8"
        />
      </div>
      
      {/* Checkbox filters */}
      <div className="flex gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="reviewed"
            checked={reviewed}
            onCheckedChange={(checked) => setFilter('reviewed', checked)}
          />
          <Label htmlFor="reviewed">Reviewed</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hasError"
            checked={hasError}
            onCheckedChange={(checked) => setFilter('hasError', checked)}
          />
          <Label htmlFor="hasError">With errors</Label>
        </div>
      </div>
    </div>
  );
};

export default PromptRunFilters;
