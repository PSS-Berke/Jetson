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
}

export function ProcessTypeSummaryRow({
  summary,
  timeRanges,
  showNotes,
  isExpanded,
  hasBreakdowns,
  onToggleExpand,
  isFacilitySummary = false,
  facilityName,
}: ProcessTypeSummaryRowProps) {
  const displayValue = summary.grandTotal;
  const formattedTotal = formatQuantity(Math.round(displayValue));

  // Create display label
  const displayLabel = isFacilitySummary && facilityName
    ? `${summary.processType} (${facilityName})`
    : summary.processType;

  return (
    <tr className="bg-blue-50 font-semibold text-sm border-b border-blue-200">
      {/* Empty checkbox column */}
      <th className="px-2 py-2 w-12"></th>
      {/* Job # column */}
      <th className="px-2 py-2"></th>
      {/* Client column */}
      <th className="px-2 py-2"></th>
      {/* Sub-client column */}
      <th className="px-2 py-2"></th>
      {/* Process column */}
      <th className="px-2 py-2"></th>
      {/* Description column */}
      <th className="px-2 py-2"></th>
      {/* Qty column */}
      <th className="px-2 py-2"></th>
      {/* Start & End columns - Process type name with controls */}
      <th colSpan={2} className="px-2 py-2 text-left">
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
      {/* Time period totals */}
      {timeRanges.map((range, index) => {
        const periodValue = summary.weeklyTotals.get(range.label) || 0;
        const formattedValue = formatQuantity(Math.round(periodValue));

        return (
          <th
            key={range.label}
            className={`px-2 py-2 text-center text-xs font-semibold ${
              index % 2 === 0 ? "bg-blue-100" : "bg-blue-50"
            }`}
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
