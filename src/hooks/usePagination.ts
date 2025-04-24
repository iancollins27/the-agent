
import { useState } from 'react';

export const usePagination = (initialPage = 1, initialPageSize = 10) => {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const nextPage = () => setPage(prev => prev + 1);
  const previousPage = () => setPage(prev => Math.max(1, prev - 1));
  const goToPage = (newPage: number) => setPage(newPage);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    from,
    to,
    nextPage,
    previousPage,
    goToPage
  };
};
