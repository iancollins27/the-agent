
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, Star, AlertCircle, RefreshCw, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface PromptRunFiltersProps {
  reviewed: boolean;
  rating: number | null;
  hasError: boolean;
  search: string;
  setFilter: (key: string, value: any) => void;
}

const PromptRunFilters: React.FC<PromptRunFiltersProps> = ({
  reviewed,
  rating,
  hasError,
  search,
  setFilter,
}) => {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input
        placeholder="Search prompt runs..."
        value={search}
        onChange={(e) => setFilter("search", e.target.value)}
        className="w-[200px]"
      />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {(reviewed || rating !== null || hasError) && (
              <span className="ml-1 rounded-full bg-primary w-2 h-2" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuCheckboxItem
            checked={reviewed}
            onCheckedChange={(checked) => setFilter("reviewed", checked)}
          >
            <Check className="h-4 w-4 mr-2" />
            Reviewed Only
          </DropdownMenuCheckboxItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuCheckboxItem
            checked={hasError}
            onCheckedChange={(checked) => setFilter("hasError", checked)}
          >
            <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
            Has Error
          </DropdownMenuCheckboxItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuCheckboxItem
            checked={rating !== null}
            onCheckedChange={(checked) => setFilter("rating", checked ? 5 : null)}
          >
            <Star className="h-4 w-4 mr-2 text-yellow-500" />
            Has Rating
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          setFilter("reviewed", false);
          setFilter("rating", null);
          setFilter("hasError", false);
          setFilter("search", "");
        }}
        title="Reset Filters"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default PromptRunFilters;
