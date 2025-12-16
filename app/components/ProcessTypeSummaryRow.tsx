"use client";

import { ProcessTypeSummary, formatQuantity, TimeRange } from "@/lib/projectionUtils";
import { ChevronRight, ChevronDown } from "lucide-react";

interface ProcessTypeSummaryRowProps {
  summary: ProcessTypeSummary;
  timeRanges: TimeRange[];
  showNotes: boolean;
  isExpanded: boolean;
  hasBreakdowns: boolean;
  onToggleExpand: () => void;
  isFacilitySummary?: boolean;
  facilityName?: string;
  expandCollapseAllButton?: React.ReactNode;
  onCategoryClick?: (processType: string, timeRangeLabel?: string) => void;
  isCategoryFilterActive?: boolean;
  visibleStaticColumnKeys?: string[];
  isColumnVisible?: (key: string) => boolean;
}

// Default column keys if not provided (for backward compatibility)
const DEFAULT_STATIC_COLUMNS = [
  "job_number",
  "facility",
  "sub_client",
  "processes",
  "description",
  "quantity",
];

export function ProcessTypeSummaryRow({
  summary,
  timeRanges,
  showNotes,
  isExpanded,
  hasBreakdowns,
  onToggleExpand,
  isFacilitySummary = false,
  facilityName,
  expandCollapseAllButton,
  onCategoryClick,
  isCategoryFilterActive = false,
  visibleStaticColumnKeys,
  isColumnVisible,
}: ProcessTypeSummaryRowProps) {
  const displayValue = summary.grandTotal;
  const formattedTotal = formatQuantity(Math.round(displayValue));

  // Determine which static columns are visible (excluding checkbox, start_date, due_date)
  const staticColumnsToRender = visibleStaticColumnKeys && isColumnVisible
    ? visibleStaticColumnKeys.filter(key =>
        isColumnVisible(key) &&
        !["checkbox", "start_date", "due_date"].includes(key)
      )
    : DEFAULT_STATIC_COLUMNS;

  // Calculate colSpan for start/end date columns
  const startDateVisible = isColumnVisible ? isColumnVisible("start_date") : true;
  const dueDateVisible = isColumnVisible ? isColumnVisible("due_date") : true;
  const dateColSpan = (startDateVisible ? 1 : 0) + (dueDateVisible ? 1 : 0);

  // Create display label
  const displayLabel = isFacilitySummary && facilityName
    ? `${summary.processType} (${facilityName})`
    : summary.processType;

  return (
    <tr 
      className={`font-semibold text-sm border-b border-blue-200 ${
        isCategoryFilterActive ? "bg-blue-200" : "bg-blue-50"
      } ${onCategoryClick ? "cursor-pointer hover:bg-blue-100" : ""}`}
      onClick={(e) => {
        // Don't trigger category click when clicking expand/collapse button
        if ((e.target as HTMLElement).closest('button')) {
          return;
        }
        onCategoryClick?.(summary.processType);
      }}
    >
      {/* Checkbox column - with expand/collapse all button on first row */}
      <th className="px-2 py-2 w-12">
        {expandCollapseAllButton && (
          <div onClick={(e) => e.stopPropagation()}>
            {expandCollapseAllButton}
          </div>
        )}
      </th>
      {/* Dynamic empty cells for visible static columns */}
      {staticColumnsToRender.map((colKey) => (
        <th key={colKey} className="px-2 py-2"></th>
      ))}
      {/* Start & End columns - Process type name with controls */}
      {dateColSpan > 0 && (
      <th colSpan={dateColSpan} className="px-2 py-2 text-left">
        <div className="flex items-center gap-2">
          {/* Expand/collapse button */}
          {hasBreakdowns && (
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-blue-200 rounded transition-colors"
              title={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-700" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-700" />
              )}
            </button>
          )}

          {/* Process type label */}
          <span className="text-gray-800 font-semibold">{displayLabel}</span>
        </div>
      </th>
      )}
      {/* Time period totals */}
      {timeRanges.map((range, index) => {
        const periodValue = summary.weeklyTotals.get(range.label) || 0;
        const formattedValue = formatQuantity(Math.round(periodValue));

        return (
          <th
            key={range.label}
            className={`px-2 py-2 text-center text-xs font-semibold ${
              index % 2 === 0 ? "bg-blue-100" : "bg-blue-50"
            } ${onCategoryClick ? "cursor-pointer hover:bg-blue-200" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onCategoryClick?.(summary.processType, range.label);
            }}
          >
            {formattedValue}
          </th>
        );
      })}
      {/* Grand total */}
      <th className="px-2 py-2 text-center text-gray-800 font-semibold">
        {formattedTotal}
      </th>
      {/* Empty notes column if visible */}
      {showNotes && <th className="px-2 py-2"></th>}
    </tr>
  );
}
