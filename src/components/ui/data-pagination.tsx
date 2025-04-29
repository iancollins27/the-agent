
import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DataPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasMorePages?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  pageSize?: number;
  totalItems?: number | null;
}

export const DataPagination: React.FC<DataPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  hasMorePages,
  loading = false,
  onLoadMore,
  pageSize = 5, // Reduced default page size
  totalItems
}) => {
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    
    // Show fewer numbers if totalPages is unknown but we know there are more pages
    if (totalPages === 0 && hasMorePages) {
      const start = Math.max(0, currentPage - 1);
      const end = currentPage + 2;
      
      for (let i = start; i < end; i++) {
        if (i >= 0) pages.push(i);
      }
      
      if (hasMorePages) pages.push(-1); // -1 indicates ellipsis
      return pages;
    }
    
    // Regular pagination when we know total pages
    if (totalPages <= 5) { // Show fewer pages at once
      // If few pages, show all
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);
      
      if (currentPage > 1) {
        pages.push(-1); // -1 indicates ellipsis
      }
      
      // Show current page and neighbors (reduced window)
      const start = Math.max(1, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push(-1); // -1 indicates ellipsis
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages - 1);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();
  
  if (loading && pageNumbers.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    );
  }

  // If on first page and there are no results, don't show pagination
  if (currentPage === 0 && pageNumbers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0 || loading}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === -1) {
            // Render ellipsis
            return (
              <span 
                key={`ellipsis-${index}`} 
                className="flex h-9 w-9 items-center justify-center text-gray-500"
              >
                <MoreHorizontal className="h-4 w-4" />
              </span>
            );
          }
          
          return (
            <Button
              key={`page-${pageNum}`}
              variant={pageNum === currentPage ? "default" : "outline"}
              size="icon"
              onClick={() => onPageChange(pageNum)}
              disabled={loading}
            >
              {pageNum + 1}
            </Button>
          );
        })}
        
        {/* Next button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasMorePages || loading}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {totalItems !== null && totalItems !== undefined && pageSize && (
        <div className="text-xs text-muted-foreground">
          Showing {Math.min((currentPage * pageSize) + 1, totalItems)} - {Math.min((currentPage + 1) * pageSize, totalItems)} of {totalItems}{" "}
          items (page {currentPage + 1} of {Math.max(1, Math.ceil(totalItems / pageSize))})
        </div>
      )}
      
      {hasMorePages && onLoadMore && (
        <Button 
          variant="outline" 
          onClick={onLoadMore}
          disabled={loading}
          className="mt-2"
        >
          {loading ? "Loading..." : "Load More"}
        </Button>
      )}
    </div>
  );
};
