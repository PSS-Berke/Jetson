"use client";

import React from "react";
import { ParsedJob } from "@/hooks/useJobs";
import { JobProjection } from "@/hooks/useProjections";
import { TimeRange, ProcessProjection, formatQuantity } from "@/lib/projectionUtils";
import ProcessTypeBadge from "../ProcessTypeBadge";
import { Edit2, Save, X } from "lucide-react";
import type { JobNote } from "@/lib/api";
import type { CellIdentifier } from "@/types";
import { ProjectionColumnConfig, SortField } from "./columnConfig";
import { timestampToDate } from "@/lib/dateUtils";

// Helper to truncate job numbers for table display
export const formatJobNumber = (jobNumber: string, maxLength = 7) => {
  if (jobNumber.length <= maxLength) return jobNumber;
  return `${jobNumber.slice(0, maxLength)}…`;
};

// Helper function to convert hex to rgba with opacity
export const hexToRgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// ============================================
// HEADER RENDER CONTEXT
// ============================================

export interface HeaderRenderContext {
  // Selection state (for checkbox column)
  allSelected: boolean;
  someSelected: boolean;
  selectAllIndeterminate: boolean;
  onSelectAll: (checked: boolean) => void;

  // Sorting
  sortField: SortField | null;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;

  // Time ranges (for time_range column type)
  timeRanges: TimeRange[];

  // View mode
  showExpandedProcesses: boolean;
  showNotes: boolean;
}

// ============================================
// CELL RENDER CONTEXT
// ============================================

export interface CellRenderContext {
  // Job data
  job: ParsedJob;
  projection: JobProjection | ProcessProjection;

  // Selection
  isSelected: boolean;
  onToggleSelect: () => void;

  // Time data
  timeRanges: TimeRange[];
  granularity: "weekly" | "monthly" | "quarterly";
  lastModifiedTimestamp?: number;

  // Notes
  showNotes: boolean;
  jobNotes: JobNote[];
  noteColor?: string;
  cellNotesMap?: Map<string, JobNote[]>;

  // Note editing
  editingNoteId?: number | null;
  editingText?: string;
  onStartEdit?: (noteId: number, text: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (noteId: number) => void;
  onTextChange?: (text: string) => void;
  isSavingNote?: boolean;

  // Cell notes modal
  onOpenNotesModal?: (cellId: CellIdentifier) => void;

  // For ProcessProjectionTableRow
  isFirstInGroup?: boolean;
  processProjection?: ProcessProjection;
}

// ============================================
// SORT ICON COMPONENT
// ============================================

interface SortIconProps {
  field: SortField;
  currentSortField: SortField | null;
  sortDirection: "asc" | "desc";
}

export const SortIcon: React.FC<SortIconProps> = ({
  field,
  currentSortField,
  sortDirection,
}) => {
  if (currentSortField !== field) return <span className="text-gray-400">⇅</span>;
  return <span>{sortDirection === "asc" ? "↑" : "↓"}</span>;
};

// ============================================
// HEADER RENDERERS
// ============================================

export function renderColumnHeader(
  config: ProjectionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  switch (config.type) {
    case "checkbox":
      return renderCheckboxHeader(config, context);
    case "static":
      return renderStaticHeader(config, context);
    case "status":
      return renderStatusHeader(config, context);
    case "time_range":
      return renderTimeRangeHeaders(config, context);
    case "total":
      return renderTotalHeader(config, context);
    case "notes":
      return renderNotesHeader(config, context);
    default:
      return null;
  }
}

function renderCheckboxHeader(
  config: ProjectionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  return (
    <th key="checkbox" className="pl-2 pr-1 py-2 text-left w-10">
      <input
        type="checkbox"
        checked={context.allSelected}
        ref={(input) => {
          if (input) {
            input.indeterminate = context.selectAllIndeterminate;
          }
        }}
        onChange={(e) => context.onSelectAll(e.target.checked)}
        className="w-4 h-4 cursor-pointer"
      />
    </th>
  );
}

function renderStaticHeader(
  config: ProjectionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  const align = config.align || "left";
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const flexJustify = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "";

  // Special handling for processes column when in expanded mode
  if (config.key === "processes" && context.showExpandedProcesses) {
    return (
      <th
        key={config.key}
        onClick={() => context.onSort("process_type")}
        className={`px-2 py-2 ${alignClass} text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100`}
        style={config.width ? { width: config.width } : undefined}
      >
        <div className={`flex items-center gap-1 ${flexJustify}`}>
          Process <SortIcon field="process_type" currentSortField={context.sortField} sortDirection={context.sortDirection} />
        </div>
      </th>
    );
  }

  // Non-sortable column
  if (!config.sortable || !config.sortField) {
    return (
      <th
        key={config.key}
        className={`px-2 py-2 ${alignClass} text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider`}
        style={config.width ? { width: config.width } : undefined}
      >
        {config.label}
      </th>
    );
  }

  // Sortable column
  return (
    <th
      key={config.key}
      onClick={() => context.onSort(config.sortField!)}
      className={`px-2 py-2 ${alignClass} text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100`}
      style={config.width ? { width: config.width } : undefined}
    >
      <div className={`flex items-center gap-1 ${flexJustify}`}>
        {config.label} <SortIcon field={config.sortField} currentSortField={context.sortField} sortDirection={context.sortDirection} />
      </div>
    </th>
  );
}

function renderStatusHeader(
  config: ProjectionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  const isSortable = config.sortable && config.sortField;

  return (
    <th
      key={config.key}
      className={`px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider ${
        isSortable ? "cursor-pointer hover:bg-gray-50" : ""
      }`}
      onClick={isSortable ? () => context.onSort?.(config.sortField!) : undefined}
    >
      <div className="flex items-center justify-center gap-1">
        {config.label}
        {isSortable && config.sortField && (
          <SortIcon
            field={config.sortField}
            currentSortField={context.sortField}
            sortDirection={context.sortDirection}
          />
        )}
      </div>
    </th>
  );
}

function renderTimeRangeHeaders(
  config: ProjectionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  return context.timeRanges.map((range, index) => (
    <th
      key={range.label}
      className={`px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider ${
        index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
      }`}
    >
      {range.label}
    </th>
  ));
}

function renderTotalHeader(
  config: ProjectionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  return (
    <th
      key="total"
      onClick={() => context.onSort("total")}
      className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
    >
      <div className="flex items-center justify-center gap-1">
        Total <SortIcon field="total" currentSortField={context.sortField} sortDirection={context.sortDirection} />
      </div>
    </th>
  );
}

function renderNotesHeader(
  config: ProjectionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  return (
    <th
      key="notes"
      className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider min-w-[200px]"
    >
      Notes
    </th>
  );
}

// ============================================
// CELL RENDERERS
// ============================================

export function renderCell(
  config: ProjectionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  switch (config.type) {
    case "checkbox":
      return renderCheckboxCell(config, context);
    case "static":
      return renderStaticCell(config, context);
    case "status":
      return renderStatusCell(config, context);
    case "time_range":
      return renderTimeRangeCells(config, context);
    case "total":
      return renderTotalCell(config, context);
    case "notes":
      return renderNotesCell(config, context);
    default:
      return null;
  }
}

function renderCheckboxCell(
  config: ProjectionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  // For process rows, only show checkbox on first in group
  if (context.isFirstInGroup === false) {
    return <td key="checkbox" className="pl-2 pr-1 py-2 w-10"></td>;
  }

  return (
    <td key="checkbox" className="pl-2 pr-1 py-2 w-10" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={context.isSelected}
        onChange={context.onToggleSelect}
        className="w-4 h-4 cursor-pointer"
      />
    </td>
  );
}

function renderStaticCell(
  config: ProjectionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const { job, isFirstInGroup, processProjection } = context;
  const isProcessRow = processProjection !== undefined;
  const showContent = !isProcessRow || isFirstInGroup !== false;

  switch (config.key) {
    case "job_number":
      return (
        <td
          key="job_number"
          className="pl-1 pr-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]"
          title={job.job_number}
        >
          {showContent ? formatJobNumber(job.job_number) : ""}
        </td>
      );

    case "version":
      const versionName = (job as any).version_name as string | undefined;
      return (
        <td
          key="version"
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-light)]"
        >
          {showContent ? (versionName || "v1") : ""}
        </td>
      );

    case "facility":
      return (
        <td key="facility" className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]">
          {showContent ? (job.facility?.name || "Unknown") : ""}
        </td>
      );

    case "client":
      const clientName = job.client?.name || "-";
      const truncatedClient = clientName.length > 7 ? clientName.slice(0, 7) + "…" : clientName;
      return (
        <td key="client" className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]" title={clientName}>
          {showContent ? truncatedClient : ""}
        </td>
      );

    case "sub_client":
      const subClientName = job.sub_client || "-";
      const truncatedSubClient = subClientName.length > 7 ? subClientName.slice(0, 7) + "…" : subClientName;
      return (
        <td key="sub_client" className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-light)]" title={subClientName}>
          {showContent ? truncatedSubClient : ""}
        </td>
      );

    case "processes":
      if (isProcessRow && processProjection) {
        // Single process badge for process row
        return (
          <td key="processes" className="px-2 py-2 text-xs text-[var(--text-dark)] pl-6">
            <ProcessTypeBadge processType={processProjection.processType} />
          </td>
        );
      }
      // Multiple process badges for job row
      return (
        <td key="processes" className="px-2 py-2 text-xs text-[var(--text-dark)]">
          <div className="flex flex-wrap gap-1">
            {job.requirements && job.requirements.length > 0 ? (
              [...new Set(job.requirements.map((req) => req.process_type).filter(Boolean))].map(
                (processType, idx) => (
                  <ProcessTypeBadge key={idx} processType={processType as string} />
                )
              )
            ) : (
              <span className="text-gray-400 text-xs">No processes</span>
            )}
          </div>
        </td>
      );

    case "description":
      return (
        <td key="description" className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[200px] truncate">
          {showContent ? (job.description || "N/A") : ""}
        </td>
      );

    case "quantity":
      const quantity = isProcessRow && processProjection
        ? processProjection.totalQuantity
        : job.quantity;
      return (
        <td key="quantity" className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
          {quantity.toLocaleString()}
        </td>
      );

    case "start_date":
      return (
        <td
          key="start_date"
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]"
          onClick={(e) => e.stopPropagation()}
        >
          {showContent && job.start_date
            ? new Date(job.start_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : showContent ? "N/A" : ""}
        </td>
      );

    case "due_date":
      return (
        <td
          key="due_date"
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]"
          onClick={(e) => e.stopPropagation()}
        >
          {showContent && job.due_date
            ? new Date(job.due_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : showContent ? "N/A" : ""}
        </td>
      );

    case "updated_at":
      if (!showContent) {
        return <td key="updated_at" className="px-2 py-2"></td>;
      }

      const timestamp = context.lastModifiedTimestamp;
      const updatedAt = (job as any).updated_at;
      const fallbackTimestamp = updatedAt
        ? (typeof updatedAt === "number" 
            ? timestampToDate(updatedAt).getTime()
            : new Date(updatedAt).getTime())
        : (job.created_at
            ? (typeof job.created_at === "number"
                ? timestampToDate(job.created_at).getTime()
                : new Date(job.created_at).getTime())
            : undefined);
      
      // Convert timestamp to milliseconds if needed, then to Date
      let displayDate: Date | null = null;
      if (timestamp !== undefined && timestamp !== null) {
        displayDate = timestampToDate(timestamp);
      } else if (fallbackTimestamp !== undefined) {
        displayDate = new Date(fallbackTimestamp);
      }

      return (
        <td
          key="updated_at"
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]"
        >
          {displayDate
            ? displayDate.toLocaleString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
                hour: "numeric",
                minute: "2-digit",
              })
            : "-"}
        </td>
      );

    default:
      return null;
  }
}

function renderStatusCell(
  config: ProjectionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const { job, isFirstInGroup, processProjection } = context;
  const isProcessRow = processProjection !== undefined;
  const showContent = !isProcessRow || isFirstInGroup !== false;

  if (!showContent) {
    return <td key="status" className="px-2 py-2"></td>;
  }

  const scheduleType = (job as any).schedule_type as string | undefined;
  const statusLower = (scheduleType || "soft schedule").toLowerCase();
  let statusClass: string;
  let displayLabel: string;
  if (statusLower.includes("hard")) {
    statusClass = "bg-green-100 text-green-800";
    displayLabel = "Hard";
  } else if (statusLower.includes("cancel")) {
    statusClass = "bg-red-100 text-red-800";
    displayLabel = "Cancelled";
  } else if (statusLower.includes("complete")) {
    statusClass = "bg-purple-100 text-purple-800";
    displayLabel = "Completed";
  } else if (statusLower.includes("projected")) {
    statusClass = "bg-blue-100 text-blue-800";
    displayLabel = "Projected";
  } else {
    statusClass = "bg-yellow-100 text-yellow-800";
    displayLabel = "Soft";
  }

  return (
    <td key="status" className="px-2 py-2 whitespace-nowrap text-xs text-center">
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
        title={scheduleType || "Soft Schedule"}
      >
        {displayLabel}
      </span>
    </td>
  );
}

function renderTimeRangeCells(
  config: ProjectionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const { job, projection, timeRanges, granularity, cellNotesMap, onOpenNotesModal, processProjection } = context;

  // Get the right projection data
  const weeklyQuantities = processProjection?.weeklyQuantities || (projection as JobProjection).weeklyQuantities;

  // Helper to get cell key for notes
  const getCellKeyForRange = (range: TimeRange): string => {
    return `${job.id}:${granularity}:${range.startDate.getTime()}:${range.endDate.getTime()}`;
  };

  // Helper to check if cell has notes
  const cellHasNotesForRange = (range: TimeRange): boolean => {
    if (!cellNotesMap) return false;
    const cellKey = getCellKeyForRange(range);
    const notes = cellNotesMap.get(cellKey);
    return notes !== undefined && notes.length > 0;
  };

  return timeRanges.map((range, index) => {
    const quantity = weeklyQuantities.get(range.label) || 0;
    const displayValue = formatQuantity(quantity);
    const hasCellNote = cellHasNotesForRange(range);

    return (
      <td
        key={range.label}
        className={`px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)] cursor-pointer relative ${
          index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
        } ${hasCellNote ? "ring-2 ring-inset ring-blue-400 bg-blue-50/50" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenNotesModal?.({
            jobId: job.id,
            periodLabel: range.label,
            periodStart: range.startDate.getTime(),
            periodEnd: range.endDate.getTime(),
            granularity: granularity,
          });
        }}
      >
        {displayValue}
        {hasCellNote && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
        )}
      </td>
    );
  });
}

function renderTotalCell(
  config: ProjectionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const { projection, processProjection } = context;
  const totalQuantity = processProjection?.totalQuantity || (projection as JobProjection).totalQuantity;

  return (
    <td key="total" className="px-2 py-2 whitespace-nowrap text-xs text-center font-bold text-[var(--text-dark)]">
      {formatQuantity(totalQuantity)}
    </td>
  );
}

function renderNotesCell(
  config: ProjectionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const {
    job,
    jobNotes,
    noteColor,
    cellNotesMap,
    editingNoteId,
    editingText,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onTextChange,
    isSavingNote,
    isFirstInGroup,
  } = context;

  const hasNotes = jobNotes && jobNotes.length > 0;
  const showContent = isFirstInGroup !== false;

  return (
    <td
      key="notes"
      className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[300px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cell-specific notes in compressed format */}
      {cellNotesMap && cellNotesMap.size > 0 && showContent && (
        <div className="mb-2 space-y-0.5">
          {Array.from(cellNotesMap.entries())
            .filter(([cellKey]) => cellKey.startsWith(`${job.id}:`))
            .map(([cellKey, notes]) => {
              const parts = cellKey.split(":");
              const periodLabel = notes[0]?.cell_period_label || parts[1] || "";
              return notes.map((note, idx) => (
                <div
                  key={`${cellKey}-${idx}`}
                  className="text-[10px] text-gray-600 truncate"
                  title={`${note.name || "Unknown"} - ${periodLabel}: ${note.notes}`}
                >
                  <span className="font-medium">{note.name || "Unknown"}</span>
                  <span className="mx-1">•</span>
                  <span className="text-gray-500">{periodLabel}</span>
                </div>
              ));
            })}
        </div>
      )}

      {/* Job-level notes */}
      {showContent && hasNotes ? (
        <div className="space-y-1">
          {jobNotes!.filter((note) => note && note.notes).map((note, idx) => {
            const isEditing = editingNoteId === note.id;
            const noteColorValue = note.color || noteColor || "#000000";

            return (
              <div
                key={note.id || idx}
                className="px-2 py-1 rounded border-l-2 relative group"
                style={{
                  borderLeftColor: noteColorValue,
                  backgroundColor: hexToRgba(noteColorValue, 0.1),
                }}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingText || ""}
                      onChange={(e) => onTextChange?.(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          onCancelEdit?.();
                        } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (note.id && editingText?.trim()) {
                            onSaveEdit?.(note.id);
                          }
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary-blue)] resize-none"
                      rows={3}
                      disabled={isSavingNote}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelEdit?.();
                        }}
                        disabled={isSavingNote}
                        className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        title="Cancel (Esc)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (note.id) onSaveEdit?.(note.id);
                        }}
                        disabled={isSavingNote || !note.id || !editingText?.trim()}
                        className="p-1 text-[var(--primary-blue)] hover:text-[var(--dark-blue)] disabled:opacity-50"
                        title="Save (Ctrl+Enter)"
                      >
                        {isSavingNote ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[var(--primary-blue)]"></div>
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-xs whitespace-pre-wrap break-words flex-1 ${note.id ? "cursor-pointer hover:underline" : ""}`}
                        style={{ color: noteColorValue }}
                        onClick={(e) => {
                          if (note.id && note.notes) {
                            e.stopPropagation();
                            onStartEdit?.(note.id, note.notes);
                          }
                        }}
                        title={note.id ? "Click to edit" : "Read-only note"}
                      >
                        {note.notes}
                      </p>
                      {note.id && note.notes ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onStartEdit?.(note.id!, note.notes);
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="opacity-70 hover:opacity-100 p-1.5 text-[var(--primary-blue)] hover:bg-blue-50 rounded transition-all flex-shrink-0 cursor-pointer"
                          title="Click to edit note"
                          type="button"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">(read-only)</span>
                      )}
                    </div>
                    {(note.name || note.email) && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {note.name || note.email}
                        {note.created_at && ` • ${new Date(note.created_at).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : showContent ? (
        <span className="text-gray-400">-</span>
      ) : null}
    </td>
  );
}

// ============================================
// HELPER: Calculate column count for colSpan
// ============================================

export function calculateColumnCount(
  orderedColumns: { config: ProjectionColumnConfig; isVisible: boolean }[],
  timeRangesCount: number
): number {
  let count = 0;
  for (const col of orderedColumns) {
    if (!col.isVisible) continue;
    if (col.config.type === "time_range") {
      count += timeRangesCount;
    } else {
      count += 1;
    }
  }
  return count;
}