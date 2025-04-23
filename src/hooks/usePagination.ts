
import { useState } from 'react';

interface PaginationOptions {
  initialPage?: number;
  pageSize?: number;
}

export const usePagination = ({ initialPage = 1, pageSize = 10 }: PaginationOptions = {}) => {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const nextPage = () => setCurrentPage(prev => prev + 1);
  const previousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToPage = (page: number) => setCurrentPage(page);
  
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  return {
    currentPage,
    pageSize,
    from,
    to,
    nextPage,
    previousPage,
    goToPage
  };
};
