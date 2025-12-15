"use client";

import { formatQuantity, TimeRange } from "@/lib/projectionUtils";
import type { SummaryPrimaryCategory } from "@/lib/tieredFilterUtils";

interface PrimaryCategoryRowProps {
  category: SummaryPrimaryCategory;
  processType: string;
  timeRanges: TimeRange[];
  showNotes: boolean;
  isExpanded: boolean;
  hasSubCategories: boolean;
  onToggleExpand: () => void;
  onCategoryClick?: (processType: string, primaryCategory: string, subField?: string, subFieldValue?: string, timeRangeLabel?: string) => void;
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

export function PrimaryCategoryRow({
  category,
  processType,
  timeRanges,
  showNotes,
  onCategoryClick,
  isCategoryFilterActive = false,
  orderedColumnKeys,
  isColumnVisible,
}: PrimaryCategoryRowProps) {
  const formattedTotal = formatQuantity(Math.round(category.grandTotal));

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
    onCategoryClick?.(processType, category.value, undefined, undefined, undefined);
  };

  return (
    <tr
      className={`text-sm border-b border-blue-100 ${
        isCategoryFilterActive ? "bg-blue-200" : "bg-blue-100/50"
      } ${onCategoryClick ? "cursor-pointer hover:bg-blue-100" : ""}`}
      onClick={handleRowClick}
    >
      {/* Empty checkbox column */}
      <td className="px-2 py-2 w-12"></td>
      {/* Dynamic empty cells for visible static columns */}
      {staticColumnsToRender.map((colKey) => (
        <td key={colKey} className="px-2 py-2"></td>
      ))}
      {/* Start & End columns - Primary category label */}
      {dateColSpan > 0 && (
        <td colSpan={dateColSpan} className="px-2 py-2 text-left pl-8">
          <div className="flex items-center gap-2 text-gray-700">
            <span className="text-gray-500">↳</span>
            <span className="font-medium">{category.value}</span>
            <span className="text-xs text-gray-500">({category.count} jobs)</span>
          </div>
        </td>
      )}
      {/* Time period quantities */}
      {timeRanges.map((range, index) => {
        const periodValue = category.weeklyTotals.get(range.label) || 0;
        const formattedValue = formatQuantity(Math.round(periodValue));

        return (
          <td
            key={range.label}
            className={`px-2 py-2 text-center text-xs ${
              index % 2 === 0 ? "bg-blue-100/70" : "bg-blue-50/50"
            } ${onCategoryClick ? "cursor-pointer hover:bg-blue-200" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onCategoryClick?.(processType, category.value, undefined, undefined, range.label);
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
