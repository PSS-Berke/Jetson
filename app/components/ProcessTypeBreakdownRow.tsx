"use client";

import { ProcessTypeBreakdown } from "@/types";
import { formatQuantity, TimeRange } from "@/lib/projectionUtils";

interface ProcessTypeBreakdownRowProps {
  breakdown: ProcessTypeBreakdown;
  fieldDisplayLabel: string;
  timeRanges: TimeRange[];
  showNotes: boolean;
  onCategoryClick?: (processType: string, fieldName: string, fieldValue: any, timeRangeLabel?: string) => void;
  isCategoryFilterActive?: boolean;
  orderedColumnKeys?: string[];
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

export function ProcessTypeBreakdownRow({
  breakdown,
  fieldDisplayLabel,
  timeRanges,
  showNotes,
  onCategoryClick,
  isCategoryFilterActive = false,
  orderedColumnKeys,
  isColumnVisible,
}: ProcessTypeBreakdownRowProps) {
  const formattedTotal = formatQuantity(Math.round(breakdown.totalQuantity));

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

  return (
    <tr 
      className={`text-sm border-b border-blue-100 ${
        isCategoryFilterActive ? "bg-blue-200" : "bg-blue-50/30"
      } ${onCategoryClick ? "cursor-pointer hover:bg-blue-50" : ""}`}
      onClick={() => {
        onCategoryClick?.(breakdown.processType, breakdown.fieldName, breakdown.fieldValue);
      }}
    >
      {/* Empty checkbox column */}
      <td className="px-2 py-2 w-12"></td>
      {/* Dynamic empty cells for visible static columns */}
      {staticColumnsToRender.map((colKey) => (
        <td key={colKey} className="px-2 py-2"></td>
      ))}
      {/* Start & End columns - Field value label */}
      {dateColSpan > 0 && (
      <td colSpan={dateColSpan} className="px-2 py-2 text-left pl-12">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-gray-500">↳</span>
          <span className="text-xs text-gray-500 font-medium">{fieldDisplayLabel}:</span>
          <span className="font-medium">{breakdown.fieldLabel}</span>
          <span className="text-xs text-gray-500">({breakdown.jobCount} jobs)</span>
        </div>
      </td>
      )}
      {/* Time period quantities */}
      {timeRanges.map((range, index) => {
        const periodValue = breakdown.quantities[range.label] || 0;
        const formattedValue = formatQuantity(Math.round(periodValue));

        return (
          <td
            key={range.label}
            className={`px-2 py-2 text-center text-xs ${
              index % 2 === 0 ? "bg-blue-50" : "bg-white"
            } ${onCategoryClick ? "cursor-pointer hover:bg-blue-100" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onCategoryClick?.(breakdown.processType, breakdown.fieldName, breakdown.fieldValue, range.label);
            }}
          >
            {formattedValue}
          </td>
        );
      })}
      {/* Total quantity */}
      <td className="px-2 py-2 text-center text-gray-700 font-medium">
        {formattedTotal}
      </td>
      {/* Empty notes column if visible */}
      {showNotes && <td className="px-2 py-2"></td>}
    </tr>
  );
}
