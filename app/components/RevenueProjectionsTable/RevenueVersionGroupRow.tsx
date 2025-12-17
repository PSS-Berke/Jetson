"use client";

import React, { memo, useState } from "react";
import { Layers, ChevronDown, ChevronRight } from "lucide-react";
import { ParsedJob } from "@/hooks/useJobs";
import { JobProjection } from "@/hooks/useProjections";
import { TimeRange } from "@/lib/projectionUtils";
import { VersionGroup, getVersionName } from "@/lib/versionGroupUtils";
import ProcessTypeBadge from "../ProcessTypeBadge";
import type { JobNote } from "@/lib/api";
import { hexToRgba, formatRevenue, formatJobNumber, formatTableDate } from "@/lib/tableUtils";
import { getFacilityName } from "@/lib/facilityUtils";

interface RevenueVersionGroupHeaderRowProps {
  versionGroup: VersionGroup;
  timeRanges: TimeRange[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onJobClick: (job: ParsedJob) => void;
  showNotes?: boolean;
}

/**
 * Header row for a version group in the revenue table (collapsed view or header when expanded)
 * Shows aggregated revenue data with expand/collapse chevron to reveal individual version rows
 * Uses green/financial styling consistent with the revenue table
 */
export const RevenueVersionGroupHeaderRow = memo(
  ({
    versionGroup,
    timeRanges,
    isExpanded,
    onToggleExpand,
    onJobClick,
    showNotes,
  }: RevenueVersionGroupHeaderRowProps) => {
    const { primaryJob, allVersions } = versionGroup;
    const job = primaryJob.job;
    const versionCount = allVersions.length;

    // Calculate aggregated revenue totals
    const aggregatedTotalRevenue = allVersions.reduce(
      (sum, v) => sum + v.totalRevenue,
      0
    );
    const aggregatedWeeklyRevenues = new Map<string, number>();
    allVersions.forEach((version) => {
      version.weeklyRevenues.forEach((revenue, label) => {
        const existing = aggregatedWeeklyRevenues.get(label) || 0;
        aggregatedWeeklyRevenues.set(label, existing + revenue);
      });
    });

    const handleRowClick = (e: React.MouseEvent) => {
      // If clicking the expand button, don't open job details
      if ((e.target as HTMLElement).closest(".version-expand-btn")) {
        return;
      }
      onJobClick(job);
    };

    return (
      <tr
        className="cursor-pointer bg-green-50/70 hover:bg-green-100/70 border-l-4 border-l-green-500"
        onClick={handleRowClick}
      >
        {/* Checkbox column - show expand/collapse button with layers icon */}
        <td className="px-2 py-2 w-12">
          <button
            className="version-expand-btn flex items-center justify-center p-1 hover:bg-green-200 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            title={isExpanded ? "Collapse versions" : "Expand versions"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-green-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-green-600" />
            )}
          </button>
        </td>

        {/* Job Number with version count badge */}
        <td
          className="px-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]"
          title={job.job_number}
        >
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-green-600" />
            <span>{formatJobNumber(job.job_number)}</span>
            <span className="text-[10px] text-green-700 bg-green-100 px-1 rounded">
              {versionCount}v
            </span>
          </div>
        </td>

        {/* Facility */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]">
          {getFacilityName(job.facilities_id)}
        </td>

        {/* Sub Client */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-light)]">
          {job.sub_client || "-"}
        </td>

        {/* Processes */}
        <td className="px-2 py-2 text-xs text-[var(--text-dark)]">
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

        {/* Description */}
        <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[200px] truncate">
          {job.description || "N/A"}
        </td>

        {/* Quantity - show aggregated total */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
          {allVersions.reduce((sum, v) => sum + v.job.quantity, 0).toLocaleString()}
        </td>

        {/* Start Date */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
          {formatTableDate(String(job.start_date))}
        </td>

        {/* End Date */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
          {formatTableDate(String(job.due_date))}
        </td>

        {/* Time Range Revenue Columns - show aggregated totals */}
        {timeRanges.map((range, index) => {
          const periodRevenue = aggregatedWeeklyRevenues.get(range.label) || 0;

          return (
            <td
              key={range.label}
              className={`px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-green-700 ${
                index % 2 === 0 ? "bg-green-100/50" : "bg-green-50/30"
              }`}
            >
              {formatRevenue(periodRevenue)}
            </td>
          );
        })}

        {/* Total Revenue - aggregated */}
        <td className="px-2 py-2 text-center text-xs font-bold text-green-800">
          {formatRevenue(aggregatedTotalRevenue)}
        </td>

        {/* Notes column */}
        {showNotes && (
          <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[300px]">
            <span className="text-gray-400 italic text-xs">
              {versionCount} versions - click to expand
            </span>
          </td>
        )}
      </tr>
    );
  }
);

RevenueVersionGroupHeaderRow.displayName = "RevenueVersionGroupHeaderRow";

interface RevenueVersionRowProps {
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
  onOpenNotesModal?: (jobId: number) => void;
  isLastInGroup?: boolean;
}

/**
 * Individual version row (nested under header when expanded)
 * Shows version-specific revenue data with visual connection to parent
 * Uses green/financial styling consistent with the revenue table
 */
export const RevenueVersionRow = memo(
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
    isLastInGroup,
  }: RevenueVersionRowProps) => {
    const job = projection.job;
    const versionName = getVersionName(job);
    const hasNotes = jobNotes && jobNotes.length > 0;

    const highlightStyle =
      hasNotes && noteColor && showNotes && !isSelected
        ? { backgroundColor: hexToRgba(noteColor, 0.08) }
        : undefined;

    return (
      <tr
        className={`cursor-pointer border-l-4 border-l-green-300 ${
          isSelected ? "bg-blue-100" : "hover:bg-gray-50"
        } ${isLastInGroup ? "border-b-2 border-b-green-200" : ""}`}
        style={highlightStyle}
        onClick={() => onJobClick(job)}
      >
        {/* Checkbox */}
        <td className="px-2 py-2 w-12" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 cursor-pointer"
          />
        </td>

        {/* Job Number */}
        <td
          className="px-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]"
          title={job.job_number}
        >
          <div className="flex items-center gap-1">
            <span>{formatJobNumber(job.job_number)}</span>
            <span className="text-[10px] text-green-600 font-medium">
              {versionName}
            </span>
          </div>
        </td>

        {/* Facility */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]">
          {getFacilityName(job.facilities_id)}
        </td>

        {/* Sub Client */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-light)]">
          {job.sub_client || "-"}
        </td>

        {/* Processes */}
        <td className="px-2 py-2 text-xs text-[var(--text-dark)]">
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

        {/* Description */}
        <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[200px] truncate">
          {job.description || "N/A"}
        </td>

        {/* Quantity */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
          {job.quantity.toLocaleString()}
        </td>

        {/* Start Date */}
        <td
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]"
          onClick={(e) => e.stopPropagation()}
        >
          {formatTableDate(String(job.start_date))}
        </td>

        {/* End Date */}
        <td
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]"
          onClick={(e) => e.stopPropagation()}
        >
          {formatTableDate(String(job.due_date))}
        </td>

        {/* Time Range Revenue Columns */}
        {timeRanges.map((range, index) => {
          const revenue = projection.weeklyRevenues.get(range.label) || 0;

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
        })}

        {/* Total Revenue */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-bold text-green-800">
          {formatRevenue(projection.totalRevenue)}
        </td>

        {/* Notes */}
        {showNotes && (
          <td
            className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            {hasNotes ? (
              <div className="space-y-1">
                {jobNotes!
                  .filter((note) => note && note.notes)
                  .map((note, idx) => {
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
                                } else if (
                                  (e.ctrlKey || e.metaKey) &&
                                  e.key === "Enter"
                                ) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (note.id && editingText?.trim()) {
                                    onSaveEdit?.(note.id);
                                  }
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
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
                                className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (note.id) onSaveEdit?.(note.id);
                                }}
                                disabled={
                                  isSavingNote || !note.id || !editingText?.trim()
                                }
                                className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50 text-xs font-medium"
                              >
                                {isSavingNote ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p
                              className={`text-xs whitespace-pre-wrap break-words ${
                                note.id ? "cursor-pointer hover:underline" : ""
                              }`}
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
                            {(note.name || note.email) && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {note.name || note.email}
                                {note.created_at &&
                                  ` • ${new Date(note.created_at).toLocaleDateString()}`}
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
        )}
      </tr>
    );
  }
);

RevenueVersionRow.displayName = "RevenueVersionRow";
