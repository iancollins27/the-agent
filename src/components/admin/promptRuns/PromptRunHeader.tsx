
import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface PromptRunHeaderProps {
  statusFilter: string | null;
  setStatusFilter: (value: string | null) => void;
  fetchPromptRuns: () => void;
  searchAddress: string;
  setSearchAddress: (value: string) => void;
}

const PromptRunHeader: React.FC<PromptRunHeaderProps> = ({ 
  statusFilter, 
  setStatusFilter, 
  fetchPromptRuns,
  searchAddress,
  setSearchAddress
}) => {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold">Prompt Runs</h2>
      <div className="flex space-x-4 items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by address"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
        <Select 
          value={statusFilter || "all"} 
          onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={fetchPromptRuns}>Refresh</Button>
      </div>
    </div>
  );
};

export default PromptRunHeader;
