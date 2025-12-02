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
}

export function ProcessTypeBreakdownRow({
  breakdown,
  fieldDisplayLabel,
  timeRanges,
  showNotes,
  onCategoryClick,
  isCategoryFilterActive = false,
}: ProcessTypeBreakdownRowProps) {
  const formattedTotal = formatQuantity(Math.round(breakdown.totalQuantity));

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
      {/* Job # column */}
      <td className="px-2 py-2"></td>
      {/* Client column */}
      <td className="px-2 py-2"></td>
      {/* Sub-client column */}
      <td className="px-2 py-2"></td>
      {/* Process column */}
      <td className="px-2 py-2"></td>
      {/* Description column */}
      <td className="px-2 py-2"></td>
      {/* Qty column */}
      <td className="px-2 py-2"></td>
      {/* Start & End columns - Field value label */}
      <td colSpan={2} className="px-2 py-2 text-left pl-12">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-gray-500">↳</span>
          <span className="text-xs text-gray-500 font-medium">{fieldDisplayLabel}:</span>
          <span className="font-medium">{breakdown.fieldLabel}</span>
          <span className="text-xs text-gray-500">({breakdown.jobCount} jobs)</span>
        </div>
      </td>
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
