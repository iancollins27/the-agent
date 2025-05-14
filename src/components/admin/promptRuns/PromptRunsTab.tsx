import React, { useState, useMemo } from 'react';
import PromptRunsTable from '../PromptRunsTable';
import PromptRunDetails from '../PromptRunDetails';
import { PromptRun } from '../types';
import PromptRunHeader from './PromptRunHeader';
import PromptRunLoader from './PromptRunLoader';
import EmptyPromptRunsState from './EmptyPromptRunsState';
import { usePromptRunData } from './usePromptRunData';
import { usePromptRunActions } from './usePromptRunActions';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import TablePagination from '../tables/TablePagination';

const ITEMS_PER_PAGE = 10;

const PromptRunsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("not-reviewed");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchAddress, setSearchAddress] = useState("");
  
  const { promptRuns, setPromptRuns, loading, fetchPromptRuns } = usePromptRunData(statusFilter);
  const { handleRatingChange, handleFeedbackChange } = usePromptRunActions(setPromptRuns, setSelectedRun);

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  const handleRunReviewed = (promptRunId: string) => {
    setPromptRuns(prev => 
      prev.map(run => 
        run.id === promptRunId ? { ...run, reviewed: true } : run
      )
    );
  };

  const handlePromptRerun = (promptRunId?: string) => {
    setCurrentPage(1);
    fetchPromptRuns();
  };

  const filteredPromptRuns = useMemo(() => {
    let filtered = [...promptRuns];
    
    if (reviewFilter === "reviewed") {
      filtered = filtered.filter(run => run.reviewed === true);
    } else if (reviewFilter === "not-reviewed") {
      filtered = filtered.filter(run => run.reviewed !== true);
    }
    
    if (searchAddress.trim()) {
      const searchTerm = searchAddress.toLowerCase().trim();
      filtered = filtered.filter(run => 
        run.project_address && run.project_address.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  }, [promptRuns, reviewFilter, searchAddress]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [reviewFilter, searchAddress]);

  const paginatedPromptRuns = filteredPromptRuns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
  const totalPages = Math.ceil(filteredPromptRuns.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PromptRunHeader 
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          fetchPromptRuns={fetchPromptRuns}
          searchAddress={searchAddress}
          setSearchAddress={setSearchAddress}
        />
        <div className="flex items-center space-x-4">
          <Label>Show:</Label>
          <RadioGroup 
            value={reviewFilter} 
            onValueChange={setReviewFilter}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="show-all" />
              <Label htmlFor="show-all">All</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="reviewed" id="show-reviewed" />
              <Label htmlFor="show-reviewed">Reviewed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="not-reviewed" id="show-not-reviewed" />
              <Label htmlFor="show-not-reviewed">Not Reviewed</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {loading ? (
        <PromptRunLoader />
      ) : filteredPromptRuns.length === 0 ? (
        <div className="text-center py-10">
          {searchAddress.trim() ? (
            <div className="space-y-2">
              <p className="text-lg font-medium">No prompt runs found with the address: "{searchAddress}"</p>
              <p className="text-muted-foreground">Try adjusting your search or clear it to see all results</p>
              <Button 
                variant="outline" 
                onClick={() => setSearchAddress("")}
                className="mt-2"
              >
                Clear search
              </Button>
            </div>
          ) : (
            <EmptyPromptRunsState />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <PromptRunsTable 
            promptRuns={paginatedPromptRuns} 
            onRatingChange={handleRatingChange} 
            onViewDetails={viewPromptRunDetails} 
            onRunReviewed={handleRunReviewed}
            reviewFilter={reviewFilter}
            onPromptRerun={handlePromptRerun}
          />
          
          <div className="flex justify-center mt-4">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      <PromptRunDetails 
        promptRun={selectedRun} 
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onRatingChange={handleRatingChange}
        onFeedbackChange={handleFeedbackChange}
        onPromptRerun={handlePromptRerun}
      />
    </div>
  );
};

export default PromptRunsTab;
