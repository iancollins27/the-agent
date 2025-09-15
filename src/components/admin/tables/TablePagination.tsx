
import React, { useState } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronFirst, ChevronLast } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 10,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}) => {
  const [jumpToPage, setJumpToPage] = useState('');

  const getVisiblePages = () => {
    const maxVisible = 9;
    
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const pages: (number | 'ellipsis')[] = [];
    
    // Always show first page
    pages.push(1);
    
    // Calculate range around current page
    let start = Math.max(2, currentPage - 3);
    let end = Math.min(totalPages - 1, currentPage + 3);
    
    // Adjust if we're near the beginning
    if (currentPage <= 4) {
      end = Math.min(totalPages - 1, 7);
    }
    
    // Adjust if we're near the end
    if (currentPage >= totalPages - 3) {
      start = Math.max(2, totalPages - 6);
    }
    
    // Add ellipsis after first page if needed
    if (start > 2) {
      pages.push('ellipsis');
    }
    
    // Add middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (end < totalPages - 1) {
      pages.push('ellipsis');
    }
    
    // Always show last page if there's more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpToPage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Page size selector */}
      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Show</span>
          <Select value={pageSize.toString()} onValueChange={(value) => onPageSizeChange(parseInt(value))}>
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">per page</span>
        </div>
      )}

      {/* Jump to page */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Go to page:</span>
        <Input
          type="number"
          min="1"
          max={totalPages}
          value={jumpToPage}
          onChange={(e) => setJumpToPage(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-16 h-8"
          placeholder="1"
        />
        <Button 
          onClick={handleJumpToPage} 
          size="sm" 
          variant="outline"
          disabled={!jumpToPage || parseInt(jumpToPage) < 1 || parseInt(jumpToPage) > totalPages}
        >
          Go
        </Button>
      </div>

      {/* Main pagination */}
      <Pagination>
        <PaginationContent>
          {/* First page button */}
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(1)}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            >
              <ChevronFirst className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>

          {/* Previous button */}
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => onPageChange(currentPage - 1)}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          
          {/* Page numbers */}
          {getVisiblePages().map((page, index) => (
            page === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => onPageChange(page as number)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          ))}
          
          {/* Next button */}
          <PaginationItem>
            <PaginationNext 
              onClick={() => onPageChange(currentPage + 1)}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>

          {/* Last page button */}
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(totalPages)}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            >
              <ChevronLast className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export default TablePagination;
