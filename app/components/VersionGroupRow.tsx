"use client";

import React, { memo, useState } from "react";
import { ChevronRight, ChevronDown, Layers } from "lucide-react";
import { ParsedJob } from "@/hooks/useJobs";
import { JobProjection, TimeRange, formatQuantity } from "@/lib/projectionUtils";
import { VersionGroup, getVersionName } from "@/lib/versionGroupUtils";
import ProcessTypeBadge from "./ProcessTypeBadge";
import type { JobNote } from "@/lib/api";
import type { CellIdentifier, CellGranularity } from "@/types";
import {
  renderCell,
  hexToRgba,
  formatJobNumber,
} from "./ProjectionsTable/index";
import type {
  CellRenderContext,
  OrderedColumn,
} from "./ProjectionsTable/index";

// Convert toggle granularity to cell granularity
const toCellGranularity = (
  granularity: "week" | "month" | "quarter" | undefined
): CellGranularity => {
  switch (granularity) {
    case "week":
      return "weekly";
    case "month":
      return "monthly";
    case "quarter":
      return "quarterly";
    default:
      return "weekly";
  }
};

interface VersionGroupHeaderRowProps {
  versionGroup: VersionGroup;
  timeRanges: TimeRange[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onJobClick: (job: ParsedJob) => void;
  showNotes?: boolean;
  orderedColumns: OrderedColumn[];
  granularity?: "week" | "month" | "quarter";
}

/**
 * Header row for a version group (collapsed view or header when expanded)
 * Shows primary version's data with expand/collapse chevron
 */
export const VersionGroupHeaderRow = memo(
  ({
    versionGroup,
    timeRanges,
    isExpanded,
    onToggleExpand,
    onJobClick,
    showNotes,
    orderedColumns,
    granularity,
  }: VersionGroupHeaderRowProps) => {
    const [showAggregatedTotal, setShowAggregatedTotal] = useState(false);
    const { primaryJob, allVersions, aggregatedTotalQuantity } = versionGroup;
    const job = primaryJob.job;
    const versionCount = allVersions.length;

    // Build cell context for rendering (using primary job's data)
    const cellContext: CellRenderContext = {
      job,
      projection: primaryJob,
      isSelected: false,
      onToggleSelect: () => {}, // Will trigger expand instead
      timeRanges,
      granularity: toCellGranularity(granularity),
      showNotes: showNotes ?? false,
      jobNotes: [],
    };

    const handleRowClick = (e: React.MouseEvent) => {
      // If clicking the chevron area, don't open job details
      if ((e.target as HTMLElement).closest(".version-expand-btn")) {
        return;
      }
      onJobClick(job);
    };

    const handleCheckboxClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand();
    };

    return (
      <tr
        className="cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/70 border-l-4 border-l-indigo-400"
        onClick={handleRowClick}
      >
        {orderedColumns.map((col) => {
          if (!col.isVisible) return null;

          // Custom rendering for checkbox column - show expand chevron
          if (col.config.key === "checkbox") {
            return (
              <td
                key="checkbox"
                className="pl-2 pr-1 py-2 w-10 version-expand-btn"
                onClick={handleCheckboxClick}
              >
                <button
                  className="p-0.5 hover:bg-indigo-200 rounded transition-colors"
                  title={isExpanded ? "Collapse versions" : "Expand versions"}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-indigo-600" />
                  )}
                </button>
              </td>
            );
          }

          // Custom rendering for job_number - show version count badge
          if (col.config.key === "job_number") {
            return (
              <td
                key="job_number"
                className="pl-1 pr-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]"
                title={job.job_number}
              >
                <div className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-indigo-500" />
                  <span>{formatJobNumber(job.job_number)}</span>
                  <span className="text-[10px] text-indigo-600 bg-indigo-100 px-1 rounded">
                    {versionCount}v
                  </span>
                </div>
              </td>
            );
          }

          // Custom rendering for version column - show "Multiple"
          if (col.config.key === "version") {
            return (
              <td
                key="version"
                className="px-2 py-2 whitespace-nowrap text-xs text-center text-indigo-600 font-medium"
              >
                {versionCount} versions
              </td>
            );
          }

          // Custom rendering for total column - show primary qty with aggregated on click
          if (col.config.type === "total") {
            const displayTotal = showAggregatedTotal
              ? aggregatedTotalQuantity
              : primaryJob.totalQuantity;
            return (
              <td
                key="total"
                className="px-2 py-2 text-center text-xs font-semibold text-[var(--text-dark)] cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAggregatedTotal(!showAggregatedTotal);
                }}
                title={
                  showAggregatedTotal
                    ? `Primary version: ${formatQuantity(Math.round(primaryJob.totalQuantity))}`
                    : `Total across all versions: ${formatQuantity(Math.round(aggregatedTotalQuantity))}`
                }
              >
                <span className={showAggregatedTotal ? "text-indigo-600" : ""}>
                  {formatQuantity(Math.round(displayTotal))}
                </span>
                {!showAggregatedTotal && (
                  <span className="text-[10px] text-indigo-400 ml-1">
                    ({formatQuantity(Math.round(aggregatedTotalQuantity))})
                  </span>
                )}
              </td>
            );
          }

          // Custom rendering for time range columns - show primary job's quantities
          if (col.config.type === "time_range") {
            return timeRanges.map((range, index) => {
              const periodValue = showAggregatedTotal
                ? versionGroup.aggregatedWeeklyTotals.get(range.label) || 0
                : primaryJob.weeklyQuantities.get(range.label) || 0;
              const formattedValue = formatQuantity(Math.round(periodValue));

              return (
                <td
                  key={range.label}
                  className={`px-2 py-2 text-center text-xs ${
                    index % 2 === 0 ? "bg-indigo-100/50" : "bg-indigo-50/30"
                  }`}
                >
                  {formattedValue}
                </td>
              );
            });
          }

          // Use default rendering for other columns
          return renderCell(col.config, cellContext);
        })}
      </tr>
    );
  }
);

VersionGroupHeaderRow.displayName = "VersionGroupHeaderRow";

interface VersionRowProps {
  projection: JobProjection;
  timeRanges: TimeRange[];
  onJobClick: (job: ParsedJob) => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  showNotes?: boolean;
  jobNotes?: JobNote[];
  noteColor?: string;
  editingNoteId?: number | null;
  editingText?: string;
  onStartEdit?: (noteId: number, text: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (noteId: number) => void;
  onTextChange?: (text: string) => void;
  isSavingNote?: boolean;
  onOpenNotesModal?: (cellId: CellIdentifier) => void;
  granularity?: "week" | "month" | "quarter";
  cellNotesMap?: Map<string, JobNote[]>;
  orderedColumns: OrderedColumn[];
  lastModifiedByJob?: Map<number, number>;
  isLastInGroup?: boolean;
}

/**
 * Individual version row (nested under header when expanded)
 * Shows version-specific data with visual connection to parent
 */
export const VersionRow = memo(
  ({
    projection,
    timeRanges,
    onJobClick,
    isSelected,
    onToggleSelect,
    showNotes,
    jobNotes,
    noteColor,
    editingNoteId,
    editingText,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onTextChange,
    isSavingNote,
    onOpenNotesModal,
    granularity,
    cellNotesMap,
    orderedColumns,
    lastModifiedByJob,
    isLastInGroup,
  }: VersionRowProps) => {
    const job = projection.job;
    const versionName = getVersionName(job);
    const hasNotes = jobNotes && jobNotes.length > 0;

    const cellContext: CellRenderContext = {
      job,
      projection,
      isSelected,
      onToggleSelect,
      timeRanges,
      granularity: toCellGranularity(granularity),
      showNotes: showNotes ?? false,
      jobNotes: jobNotes ?? [],
      noteColor,
      cellNotesMap,
      editingNoteId,
      editingText,
      onStartEdit,
      onCancelEdit,
      onSaveEdit,
      onTextChange,
      isSavingNote,
      onOpenNotesModal,
      lastModifiedTimestamp: lastModifiedByJob?.get(job.id),
    };

    const highlightStyle =
      hasNotes && noteColor && showNotes && !isSelected
        ? { backgroundColor: hexToRgba(noteColor, 0.08) }
        : undefined;

    return (
      <tr
        className={`cursor-pointer border-l-4 border-l-indigo-300 ${
          isSelected ? "bg-blue-100" : "bg-indigo-50/30 hover:bg-indigo-50/50"
        } ${isLastInGroup ? "border-b-2 border-b-indigo-200" : ""}`}
        style={highlightStyle}
        onClick={() => onJobClick(job)}
      >
        {orderedColumns.map((col) => {
          if (!col.isVisible) return null;

          // Custom rendering for checkbox column - show indent connector
          if (col.config.key === "checkbox") {
            return (
              <td key="checkbox" className="pl-2 pr-1 py-2 w-10">
                <div className="flex items-center pl-1">
                  <span className="text-indigo-300 mr-0.5">└</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelect();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 text-[var(--primary-blue)] rounded border-gray-300 focus:ring-[var(--primary-blue)] focus:ring-opacity-50"
                  />
                </div>
              </td>
            );
          }

          // Custom rendering for job_number column - show version name instead
          if (col.config.key === "job_number") {
            return (
              <td
                key="job_number"
                className="pl-1 pr-2 py-2 whitespace-nowrap text-xs text-indigo-600"
              >
                <span className="font-medium">{versionName}</span>
              </td>
            );
          }

          // Hide version column for version rows (redundant with job_number showing version)
          if (col.config.key === "version") {
            // Get the schedule_type/status for display
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scheduleType = (job as any).schedule_type || "soft schedule";
            return (
              <td
                key="version"
                className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-light)]"
              >
                {scheduleType}
              </td>
            );
          }

          // Use default rendering for other columns
          return renderCell(col.config, cellContext);
        })}
      </tr>
    );
  }
);

VersionRow.displayName = "VersionRow";
