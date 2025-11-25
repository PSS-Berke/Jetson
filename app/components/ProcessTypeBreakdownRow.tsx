"use client";

import { ProcessTypeBreakdown } from "@/types";
import { formatQuantity, TimeRange } from "@/lib/projectionUtils";

interface ProcessTypeBreakdownRowProps {
  breakdown: ProcessTypeBreakdown;
  fieldDisplayLabel: string;
  timeRanges: TimeRange[];
  showNotes: boolean;
}

export function ProcessTypeBreakdownRow({
  breakdown,
  fieldDisplayLabel,
  timeRanges,
  showNotes,
}: ProcessTypeBreakdownRowProps) {
  const formattedTotal = formatQuantity(Math.round(breakdown.totalQuantity));

  return (
    <tr className="bg-blue-25 text-sm border-b border-blue-100">
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
            }`}
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
