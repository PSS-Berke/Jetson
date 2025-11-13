"use client";

import { useState, useMemo, useEffect } from "react";
import { DataTableProps, SortDirection } from "./DataTableTypes";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableRow } from "./DataTableRow";
import { DataTableBulkActions } from "./DataTableBulkActions";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableMobileCard } from "./DataTableMobileCard";

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  getRowId = (row) => row.id,
  selection,
  batchEdit,
  inlineEdit,
  pagination,
  mobile,
  defaultSort,
  onSortChange,
  onRowClick,
  className = "",
  striped = true,
  hover = true,
  emptyMessage = "No data available",
  loading = false,
}: DataTableProps<T>) {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(
    new Set(),
  );

  // Sorting state
  const [sortField, setSortField] = useState<string | null>(
    defaultSort?.field || null,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    defaultSort?.direction || null,
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pagination?.pageSize || 25);

  // Mobile view state
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Helper to get nested value
  const getValue = (row: T, key: string): any => {
    const column = columns.find((col) => col.key === key);
    if (column?.getValue) {
      return column.getValue(row);
    }

    const keys = key.split(".");
    let value: any = row;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    return value;
  };

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = getValue(a, sortField);
      const bValue = getValue(b, sortField);

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortField, sortDirection]);

  // Paginated data
  const paginatedData = useMemo(() => {
    if (!pagination?.enabled) return sortedData;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize, pagination?.enabled]);

  const totalPages = pagination?.enabled
    ? Math.ceil(sortedData.length / pageSize)
    : 1;

  // Selection handlers
  const handleToggleSelect = (rowId: number | string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedIds(newSelected);

    if (selection?.onSelectionChange) {
      const selectedRows = data.filter((row) => newSelected.has(getRowId(row)));
      selection.onSelectionChange(
        Array.from(newSelected) as number[],
        selectedRows,
      );
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedData.map(getRowId));
      setSelectedIds(allIds);

      if (selection?.onSelectionChange) {
        selection.onSelectionChange(
          Array.from(allIds) as number[],
          paginatedData,
        );
      }
    } else {
      setSelectedIds(new Set());
      if (selection?.onSelectionChange) {
        selection.onSelectionChange([], []);
      }
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    if (selection?.onSelectionChange) {
      selection.onSelectionChange([], []);
    }
  };

  // Sorting handler
  const handleSort = (field: string) => {
    let newDirection: SortDirection = "asc";

    if (sortField === field) {
      if (sortDirection === "asc") {
        newDirection = "desc";
      } else if (sortDirection === "desc") {
        newDirection = null;
        setSortField(null);
      }
    }

    if (newDirection !== null) {
      setSortField(field);
    }
    setSortDirection(newDirection);

    onSortChange?.({ field, direction: newDirection });
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    pagination?.onPageChange?.(page, pageSize);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    pagination?.onPageChange?.(1, newPageSize);
  };

  // Calculate selection state
  const allSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row) => selectedIds.has(getRowId(row)));
  const someSelected = paginatedData.some((row) =>
    selectedIds.has(getRowId(row)),
  );
  const selectAllIndeterminate = someSelected && !allSelected;

  const selectedRows = useMemo(() => {
    return data.filter((row) => selectedIds.has(getRowId(row)));
  }, [data, selectedIds, getRowId]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-gray-500">{emptyMessage}</div>
      </div>
    );
  }

  // Mobile card view
  if (isMobile && mobile?.viewMode === "cards") {
    return (
      <div className={className}>
        {selection?.enabled && selection.bulkActions && (
          <DataTableBulkActions
            selectedCount={selectedIds.size}
            selectedRows={selectedRows}
            bulkActions={selection.bulkActions}
            onClearSelection={handleClearSelection}
          />
        )}

        <div className="space-y-3">
          {paginatedData.map((row, index) => {
            const rowId = getRowId(row);
            return (
              <DataTableMobileCard
                key={rowId}
                row={row}
                columns={columns}
                selectionEnabled={selection?.enabled || false}
                isSelected={selectedIds.has(rowId)}
                onToggleSelect={() => handleToggleSelect(rowId)}
                onRowClick={onRowClick}
                customTemplate={mobile.cardTemplate}
              />
            );
          })}
        </div>

        {pagination?.enabled && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={pagination.pageSizeOptions || [10, 25, 50, 100]}
            totalItems={sortedData.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className={className}>
      {selection?.enabled && selection.bulkActions && (
        <DataTableBulkActions
          selectedCount={selectedIds.size}
          selectedRows={selectedRows}
          bulkActions={selection.bulkActions}
          onClearSelection={handleClearSelection}
        />
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <DataTableHeader
            columns={columns}
            selectionEnabled={selection?.enabled || false}
            selectAllChecked={allSelected}
            selectAllIndeterminate={selectAllIndeterminate}
            onSelectAll={handleSelectAll}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <tbody>
            {paginatedData.map((row, index) => {
              const rowId = getRowId(row);
              return (
                <DataTableRow
                  key={rowId}
                  row={row}
                  rowId={rowId}
                  columns={columns}
                  selectionEnabled={selection?.enabled || false}
                  isSelected={selectedIds.has(rowId)}
                  onToggleSelect={() => handleToggleSelect(rowId)}
                  onRowClick={onRowClick}
                  inlineEdit={inlineEdit}
                  striped={striped}
                  hover={hover}
                  index={index}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination?.enabled && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={pagination.pageSizeOptions || [10, 25, 50, 100]}
          totalItems={sortedData.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
