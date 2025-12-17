"use client";

import React from "react";
import { ParsedJob } from "@/hooks/useJobs";
import { JobProjection } from "@/hooks/useProjections";
import { TimeRange, ProcessProjection } from "@/lib/projectionUtils";
import { hexToRgba, formatRevenue, formatJobNumber, formatTableDate } from "@/lib/tableUtils";
import ProcessTypeBadge from "../ProcessTypeBadge";
import { Edit2, Save, X } from "lucide-react";
import type { JobNote } from "@/lib/api";
import { RevenueColumnConfig, SortField } from "./columnConfig";
import { getFacilityName } from "@/lib/facilityUtils";
import { getStatusDisplay } from "@/lib/columnConfig";

// Re-export utilities for convenience
export { hexToRgba, formatRevenue, formatJobNumber };

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

  // Note editing
  editingNoteId?: number | null;
  editingText?: string;
  onStartEdit?: (noteId: number, text: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (noteId: number) => void;
  onTextChange?: (text: string) => void;
  isSavingNote?: boolean;

  // Revenue modal
  onOpenNotesModal?: (jobId: number) => void;

  // For ProcessProjection row
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
  config: RevenueColumnConfig,
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
  config: RevenueColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  return (
    <th key="checkbox" className="px-2 py-2 text-left w-12">
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
  config: RevenueColumnConfig,
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
  config: RevenueColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  return (
    <th
      key={config.key}
      onClick={() => context.onSort("status")}
      className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
    >
      <div className="flex items-center justify-center gap-1">
        Status <SortIcon field="status" currentSortField={context.sortField} sortDirection={context.sortDirection} />
      </div>
    </th>
  );
}

function renderTimeRangeHeaders(
  config: RevenueColumnConfig,
  context: HeaderRenderContext
): React.ReactNode[] {
  return context.timeRanges.map((range, index) => (
    <th
      key={range.label}
      className={`px-2 py-2 text-center text-[10px] font-medium text-green-700 uppercase tracking-wider ${
        index % 2 === 0 ? "bg-green-50" : "bg-white"
      }`}
    >
      {range.label}
    </th>
  ));
}

function renderTotalHeader(
  config: RevenueColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  return (
    <th
      key={config.key}
      onClick={() => context.onSort("total_revenue")}
      className="px-2 py-2 text-center text-[10px] font-medium text-green-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
    >
      <div className="flex items-center justify-center gap-1">
        Total Revenue <SortIcon field="total_revenue" currentSortField={context.sortField} sortDirection={context.sortDirection} />
      </div>
    </th>
  );
}

function renderNotesHeader(
  config: RevenueColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  if (!context.showNotes) return null;
  return (
    <th
      key={config.key}
      className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider"
      style={config.minWidth ? { minWidth: config.minWidth } : undefined}
    >
      Notes
    </th>
  );
}

// ============================================
// CELL RENDERERS
// ============================================

export function renderCell(
  config: RevenueColumnConfig,
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
  config: RevenueColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  // For process rows, only show checkbox on first row of group
  if (context.processProjection && !context.isFirstInGroup) {
    return <td key="checkbox" className="px-2 py-2 w-12"></td>;
  }

  return (
    <td key="checkbox" className="px-2 py-2 w-12" onClick={(e) => e.stopPropagation()}>
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
  config: RevenueColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const { job, processProjection, isFirstInGroup } = context;

  switch (config.key) {
    case "job_number":
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2"></td>;
      }
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]">
          {formatJobNumber(job.job_number)}
        </td>
      );

    case "version":
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2"></td>;
      }
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
          {(job as any).version_name || "-"}
        </td>
      );

    case "facility":
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2"></td>;
      }
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]">
          {getFacilityName(job.facilities_id)}
        </td>
      );

    case "client":
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2"></td>;
      }
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)] max-w-[150px] truncate">
          {job.client?.name || "-"}
        </td>
      );

    case "sub_client":
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2"></td>;
      }
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-light)]">
          {job.sub_client || "-"}
        </td>
      );

    case "processes":
      if (processProjection) {
        return (
          <td key={config.key} className="px-2 py-2 text-xs text-[var(--text-dark)] pl-6">
            <ProcessTypeBadge processType={processProjection.processType} />
          </td>
        );
      }
      return (
        <td key={config.key} className="px-2 py-2 text-xs text-[var(--text-dark)]">
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
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2"></td>;
      }
      return (
        <td key={config.key} className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[200px] truncate">
          {job.description || "N/A"}
        </td>
      );

    case "quantity":
      if (processProjection) {
        return (
          <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
            {processProjection.totalQuantity.toLocaleString()}
          </td>
        );
      }
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
          {job.quantity.toLocaleString()}
        </td>
      );

    case "start_date":
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2" onClick={(e) => e.stopPropagation()}></td>;
      }
      return (
        <td
          key={config.key}
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]"
          onClick={(e) => e.stopPropagation()}
        >
          {formatTableDate(String(job.start_date))}
        </td>
      );

    case "due_date":
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2" onClick={(e) => e.stopPropagation()}></td>;
      }
      return (
        <td
          key={config.key}
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]"
          onClick={(e) => e.stopPropagation()}
        >
          {formatTableDate(String(job.due_date))}
        </td>
      );

    case "updated_at":
      if (processProjection && !isFirstInGroup) {
        return <td key={config.key} className="px-2 py-2"></td>;
      }
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
          {context.lastModifiedTimestamp
            ? new Date(context.lastModifiedTimestamp).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : formatTableDate(String((job as any).updated_at || job.created_at))}
        </td>
      );

    default:
      return <td key={config.key} className="px-2 py-2">-</td>;
  }
}

function renderStatusCell(
  config: RevenueColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const { job, processProjection, isFirstInGroup } = context;

  if (processProjection && !isFirstInGroup) {
    return <td key={config.key} className="px-2 py-2"></td>;
  }

  const statusDisplay = getStatusDisplay((job as any).schedule_type);

  return (
    <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusDisplay.className}`}>
        {statusDisplay.label}
      </span>
    </td>
  );
}

function renderTimeRangeCells(
  config: RevenueColumnConfig,
  context: CellRenderContext
): React.ReactNode[] {
  const { projection, processProjection, timeRanges, onOpenNotesModal, job } = context;

  return timeRanges.map((range, index) => {
    // Get revenue from either process or job projection
    const revenue = processProjection
      ? processProjection.weeklyRevenues.get(range.label) || 0
      : (projection as JobProjection).weeklyRevenues.get(range.label) || 0;

    return (
      <td
        key={range.label}
        className={`px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-green-700 cursor-pointer ${
          index % 2 === 0 ? "bg-green-50" : "bg-white"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenNotesModal?.(job.id);
        }}
      >
        {formatRevenue(revenue)}
      </td>
    );
  });
}

function renderTotalCell(
  config: RevenueColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const { projection, processProjection } = context;

  const totalRevenue = processProjection
    ? processProjection.totalRevenue
    : (projection as JobProjection).totalRevenue;

  return (
    <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center font-bold text-green-800">
      {formatRevenue(totalRevenue)}
    </td>
  );
}

function renderNotesCell(
  config: RevenueColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const {
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
    processProjection,
    isFirstInGroup,
  } = context;

  if (!showNotes) return null;

  // For process rows, only show notes on first row
  if (processProjection && !isFirstInGroup) {
    return (
      <td key={config.key} className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[300px]">
        <span className="text-gray-400">-</span>
      </td>
    );
  }

  const hasNotes = jobNotes && jobNotes.length > 0;

  return (
    <td
      key={config.key}
      className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[300px]"
      onClick={(e) => e.stopPropagation()}
    >
      {hasNotes ? (
        <div className="space-y-1">
          {jobNotes.filter((note) => note && note.notes).map((note, idx) => {
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
      ) : (
        <span className="text-gray-400">-</span>
      )}
    </td>
  );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate total column count for colspan calculations
 */
export function calculateColumnCount(
  timeRangesCount: number,
  showNotes: boolean
): number {
  // checkbox + job_number + version + status + facility + client + sub_client + processes + description + quantity + start_date + due_date + updated_at + time_ranges + total + notes
  const baseColumns = 13; // excluding time_ranges and notes
  return baseColumns + timeRangesCount + 1 + (showNotes ? 1 : 0); // +1 for total_revenue
}
