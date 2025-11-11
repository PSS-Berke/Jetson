import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  totalItems,
  onPageChange,
  onPageSizeChange
}: DataTablePaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">
          Showing {startItem}-{endItem} of {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-sm text-gray-700">
            Per page:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;

            // Smart pagination: show first, last, current, and surrounding pages
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = currentPage - 3 + i;
            }

            return (
              <button
                key={i}
                onClick={() => onPageChange(pageNum)}
                className={`
                  px-3 py-1 rounded text-sm font-medium
                  ${currentPage === pageNum
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                  }
                `}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
