import { ChevronUp, ChevronDown } from "lucide-react";
import { ColumnConfig, SortDirection } from "./DataTableTypes";

interface DataTableHeaderProps<T> {
  columns: ColumnConfig<T>[];
  selectionEnabled: boolean;
  selectAllChecked: boolean;
  selectAllIndeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
  sortField: string | null;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
}

export function DataTableHeader<T>({
  columns,
  selectionEnabled,
  selectAllChecked,
  selectAllIndeterminate,
  onSelectAll,
  sortField,
  sortDirection,
  onSort,
}: DataTableHeaderProps<T>) {
  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        {selectionEnabled && (
          <th className="px-3 py-3 text-left w-12">
            <input
              type="checkbox"
              checked={selectAllChecked}
              ref={(input) => {
                if (input) {
                  input.indeterminate = selectAllIndeterminate;
                }
              }}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
          </th>
        )}
        {columns.map((column) => {
          const isSorted = sortField === column.key;
          const alignClass =
            column.align === "right"
              ? "text-right"
              : column.align === "center"
                ? "text-center"
                : "text-left";

          return (
            <th
              key={column.key}
              className={`px-3 py-3 ${alignClass} font-semibold text-sm text-gray-700 ${
                column.sortable
                  ? "cursor-pointer hover:bg-gray-100 select-none"
                  : ""
              }`}
              onClick={() => column.sortable && onSort(column.key)}
              style={{ width: column.width }}
            >
              <div
                className={`flex items-center gap-1 ${column.align === "right" ? "justify-end" : column.align === "center" ? "justify-center" : ""}`}
              >
                <span>{column.label}</span>
                {column.sortable && (
                  <div className="flex flex-col">
                    {isSorted && sortDirection === "asc" ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : isSorted && sortDirection === "desc" ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <div className="w-4 h-4 opacity-30">
                        <ChevronUp className="w-4 h-2" />
                        <ChevronDown className="w-4 h-2 -mt-1" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
