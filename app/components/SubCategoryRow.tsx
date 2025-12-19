"use client";

import { formatQuantity, TimeRange } from "@/lib/projectionUtils";
import type { SummarySubCategory } from "@/lib/tieredFilterUtils";
import { ChevronRight, ChevronDown } from "lucide-react";

interface SubCategoryRowProps {
  subCategory: SummarySubCategory;
  processType: string;
  primaryCategory: string;
  timeRanges: TimeRange[];
  showNotes: boolean;
  isExpanded: boolean;
  hasJobs: boolean;
  onToggleExpand: () => void;
  onCategoryClick?: (
    processType: string,
    primaryCategory: string,
    subField: string,
    subFieldValue: string,
    timeRangeLabel?: string
  ) => void;
  isCategoryFilterActive?: boolean;
  orderedColumnKeys?: string[];
  isColumnVisible?: (key: string) => boolean;
}

// Default column keys if not provided (for backward compatibility)
const DEFAULT_STATIC_COLUMNS = [
  "job_number",
  "version",
  "facility",
  "sub_client",
  "processes",
  "description",
  "quantity",
];

export function SubCategoryRow({
  subCategory,
  processType,
  primaryCategory,
  timeRanges,
  showNotes,
  isExpanded,
  hasJobs,
  onToggleExpand,
  onCategoryClick,
  isCategoryFilterActive = false,
  orderedColumnKeys,
  isColumnVisible,
}: SubCategoryRowProps) {
  const formattedTotal = formatQuantity(Math.round(subCategory.grandTotal));

  // Determine which static columns are visible (excluding checkbox, start_date, due_date)
  const staticColumnsToRender = orderedColumnKeys && isColumnVisible
    ? orderedColumnKeys.filter(key =>
        isColumnVisible(key) &&
        !["checkbox", "start_date", "due_date"].includes(key)
      )
    : DEFAULT_STATIC_COLUMNS;

  // Calculate colSpan for start/end date columns
  const startDateVisible = isColumnVisible ? isColumnVisible("start_date") : true;
  const dueDateVisible = isColumnVisible ? isColumnVisible("due_date") : true;
  const dateColSpan = (startDateVisible ? 1 : 0) + (dueDateVisible ? 1 : 0);

  const handleRowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCategoryClick?.(
      processType,
      primaryCategory,
      subCategory.fieldName,
      subCategory.value
    );
  };

  return (
    <tr
      className={`text-sm border-b border-gray-100 ${
        isCategoryFilterActive ? "bg-gray-200" : "bg-gray-50/50"
      } ${onCategoryClick ? "cursor-pointer hover:bg-gray-100" : ""}`}
      onClick={handleRowClick}
    >
      {/* Empty checkbox column */}
      <td className="px-2 py-1.5 w-12"></td>
      {/* Dynamic empty cells for visible static columns */}
      {staticColumnsToRender.map((colKey) => (
        <td key={colKey} className="px-2 py-1.5"></td>
      ))}
      {/* Start & End columns - Sub-category label */}
      <td colSpan={dateColSpan > 0 ? dateColSpan : 1} className="px-2 py-1.5 text-left pl-12">
        <div className="flex items-center gap-1 text-gray-600">
          {/* Expand/collapse button */}
          {hasJobs ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              title={isExpanded ? "Collapse jobs" : "Expand jobs"}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span className="text-gray-400">↳↳</span>
          <span className="text-xs text-gray-500">{subCategory.fieldLabel}:</span>
          <span className="font-medium text-xs">{subCategory.value}</span>
          <span className="text-xs text-gray-400">({subCategory.count})</span>
        </div>
      </td>
      {/* Time period quantities */}
      {timeRanges.map((range, index) => {
        const periodValue = subCategory.weeklyTotals.get(range.label) || 0;
        const formattedValue = formatQuantity(Math.round(periodValue));

        return (
          <td
            key={range.label}
            className={`px-2 py-1.5 text-center text-xs ${
              index % 2 === 0 ? "bg-gray-100/50" : "bg-gray-50/30"
            } ${onCategoryClick ? "cursor-pointer hover:bg-gray-200" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onCategoryClick?.(
                processType,
                primaryCategory,
                subCategory.fieldName,
                subCategory.value,
                range.label
              );
            }}
          >
            {formattedValue}
          </td>
        );
      })}
      {/* Total quantity */}
      <td className="px-2 py-1.5 text-center text-gray-600 font-medium text-xs">
        {formattedTotal}
      </td>
      {/* Empty notes column if visible */}
      {showNotes && <td className="px-2 py-1.5"></td>}
    </tr>
  );
}
