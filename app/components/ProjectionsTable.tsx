"use client";

import React, { useState, memo, useMemo, useEffect, useRef, useCallback } from "react";
import { ParsedJob } from "@/hooks/useJobs";
import { JobProjection, ServiceTypeSummary, ProcessTypeSummary, ProcessTypeFacilitySummary } from "@/hooks/useProjections";
import {
  formatQuantity,
  TimeRange,
  ProcessProjection,
  expandJobProjectionsToProcesses,
  calculateProcessTypeBreakdownByField,
} from "@/lib/projectionUtils";
import JobDetailsModal from "./JobDetailsModal";
import JobNotesModal from "./JobNotesModal";
import ProcessTypeBadge from "./ProcessTypeBadge";
import { ProcessTypeSummaryRow } from "./ProcessTypeSummaryRow";
import { ProcessTypeBreakdownRow } from "./ProcessTypeBreakdownRow";
import { PrimaryCategoryRow } from "./PrimaryCategoryRow";
import { SubCategoryRow } from "./SubCategoryRow";
import { buildSummaryTieredData, getPrimaryCategoryValue, getJobProcessTypes } from "@/lib/tieredFilterUtils";
import { groupProjectionsByVersion, isVersionGroup, type VersionGroup } from "@/lib/versionGroupUtils";
import { VersionGroupHeaderRow, VersionRow } from "./VersionGroupRow";
import { Trash, Lock, Unlock, ChevronDown, ChevronRight, FileText, Eye, EyeOff, Edit2, Save, X } from "lucide-react";
import { bulkDeleteJobs, bulkUpdateJobs, getJobNotes, updateJobNote, type JobNote, getAllMachineVariables } from "@/lib/api";
import type { ServiceTypeLoadItem } from "@/lib/api";
import { getBreakdownableFields, normalizeProcessType } from "@/lib/processTypeConfig";
import type { CellIdentifier, CellGranularity } from "@/types";
import { useCellNotes } from "@/hooks/useCellNotes";
import {
  useColumnSettings,
  ColumnSettingsPopover,
  renderColumnHeader,
  renderCell,
  formatJobNumber,
  hexToRgba,
  calculateColumnCount,
} from "./ProjectionsTable/index";
import type {
  HeaderRenderContext,
  CellRenderContext,
  SortField,
  ProjectionColumnConfig,
  OrderedColumn,
} from "./ProjectionsTable/index";
import { getSizeFieldsForProcessTypeCached, type SizeField } from "@/lib/sizeFieldUtils";

// Convert toggle granularity to cell granularity
const toCellGranularity = (
  granularity: "week" | "month" | "quarter" | undefined,
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

type SortDirection = "asc" | "desc";

interface ProjectionsTableProps {
  timeRanges: TimeRange[]; // Can be weeks, months, or quarters
  jobProjections: JobProjection[];
  serviceSummaries: ServiceTypeSummary[];
  processTypeSummaries: ProcessTypeSummary[] | ProcessTypeFacilitySummary[];
  grandTotals: {
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  };
  onRefresh: () => void;
  mobileViewMode?: "cards" | "table";
  globalTimeScrollIndex?: number;
  onGlobalTimeScrollIndexChange?: (index: number) => void;
  showExpandedProcesses?: boolean;
  showNotes?: boolean;
  onShowNotesChange?: (show: boolean) => void;
  granularity?: "week" | "month" | "quarter"; // NEW: for cell-level notes
  fullFilteredProjections?: JobProjection[]; // NEW: Full filtered data for breakdown calculations
  lastModifiedByJob?: Map<number, number>; // Map of job ID to last modified timestamp
  versionGroupingEnabled?: boolean; // Whether to group job versions together
  serviceTypeLoadData?: import("@/lib/api").ServiceTypeLoadItem[]; // API data for breakdowns
}

// Type guard to check if summary has facility information
function isFacilitySummary(
  summary: ProcessTypeSummary | ProcessTypeFacilitySummary
): summary is ProcessTypeFacilitySummary {
  return 'facilityId' in summary && 'facilityName' in summary;
}

// Transform service type load API data to ProcessTypeBreakdown format
function transformServiceTypeLoadToBreakdowns(
  serviceTypeLoadData: ServiceTypeLoadItem[],
  processType: string,
  fieldName: string,
  timeRanges: TimeRange[],
  granularity: "week" | "month" | "quarter",
): import("@/types").ProcessTypeBreakdown[] {
  const normalizedProcessType = normalizeProcessType(processType).toLowerCase();
  const breakdownMap = new Map<string, import("@/types").ProcessTypeBreakdown>();

  // Determine which time data property to use
  const timeDataProperty = granularity === "week" ? "weekly" : granularity === "month" ? "monthly" : "quarterly";

  // Filter API data for this process type and field
  const relevantItems = serviceTypeLoadData.filter((item) => {
    const itemProcessType = normalizeProcessType(item.service_type).toLowerCase();
    return itemProcessType === normalizedProcessType && item.key === fieldName;
  });

  console.log(`[transformServiceTypeLoadToBreakdowns] Found ${relevantItems.length} items for processType="${normalizedProcessType}", field="${fieldName}"`);

  relevantItems.forEach((item) => {
    const fieldValue = item.value;
    const breakdownKey = `${fieldName}:${fieldValue}`;

    if (!breakdownMap.has(breakdownKey)) {
      // Initialize quantities for all time ranges
      const quantities: { [timeRangeKey: string]: number } = {};
      timeRanges.forEach((range) => {
        quantities[range.label] = 0;
      });

      breakdownMap.set(breakdownKey, {
        processType: normalizedProcessType,
        fieldName,
        fieldValue,
        fieldLabel: String(fieldValue),
        quantities,
        totalQuantity: 0,
        jobCount: 0,
      });
    }

    const breakdown = breakdownMap.get(breakdownKey)!;

    // Parse time data from API
    const timeDataStr = item[timeDataProperty] || "{}";
    let timeData: Record<string, number> = {};
    try {
      timeData = JSON.parse(timeDataStr);
    } catch (e) {
      console.warn(`[transformServiceTypeLoadToBreakdowns] Failed to parse ${timeDataProperty} data:`, e);
    }

    // Map time data to time range labels
    timeRanges.forEach((range) => {
      let matchedValue = 0;

      // Try direct match first
      if (timeData[range.label]) {
        matchedValue = timeData[range.label];
      } else {
        // Try to match by date
        const rangeDate = range.startDate;
        for (const [key, value] of Object.entries(timeData)) {
          let keyMatches = false;

          if (granularity === "week") {
            const [month, day] = key.split("/").map(Number);
            if (month === rangeDate.getMonth() + 1 && day === rangeDate.getDate()) {
              keyMatches = true;
            }
          } else if (granularity === "month") {
            const rangeYearMonth = `${rangeDate.getFullYear()}-${String(rangeDate.getMonth() + 1).padStart(2, "0")}`;
            if (key === rangeYearMonth || key.startsWith(rangeYearMonth)) {
              keyMatches = true;
            }
          } else if (granularity === "quarter") {
            const quarter = Math.floor(rangeDate.getMonth() / 3) + 1;
            const rangeYearQuarter = `${rangeDate.getFullYear()}-Q${quarter}`;
            if (key === rangeYearQuarter || key.includes(`${rangeDate.getFullYear()}-Q${quarter}`)) {
              keyMatches = true;
            }
          }

          if (keyMatches) {
            matchedValue = typeof value === "number" ? value : parseFloat(String(value)) || 0;
            break;
          }
        }
      }

      breakdown.quantities[range.label] = (breakdown.quantities[range.label] || 0) + matchedValue;
    });

    // Update totals
    breakdown.totalQuantity += item.key_total || 0;
    breakdown.jobCount = Math.max(breakdown.jobCount, item.job_count || 0);
  });

  // Convert to array and sort
  const result = Array.from(breakdownMap.values()).sort((a, b) => {
    if (typeof a.fieldValue === "boolean" && typeof b.fieldValue === "boolean") {
      return a.fieldValue === b.fieldValue ? 0 : a.fieldValue ? -1 : 1;
    }
    if (typeof a.fieldValue === "number" && typeof b.fieldValue === "number") {
      return a.fieldValue - b.fieldValue;
    }
    return String(a.fieldValue).localeCompare(String(b.fieldValue));
  });

  console.log(`[transformServiceTypeLoadToBreakdowns] Returning ${result.length} breakdown entries`);
  return result;
}

// Memoized desktop table row component
const ProjectionTableRow = memo(
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
  }: {
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
  }) => {
    const job = projection.job;
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

    const highlightStyle = hasNotes && noteColor && showNotes && !isSelected
      ? { backgroundColor: hexToRgba(noteColor, 0.08) }
      : undefined;

    return (
      <tr
        className={`cursor-pointer ${isSelected ? "bg-blue-100" : ""}`}
        style={highlightStyle}
        onClick={() => onJobClick(job)}
      >
        {orderedColumns.map((col) => (col.isVisible ? renderCell(col.config, cellContext) : null))}
      </tr>
    );
  },
);

ProjectionTableRow.displayName = "ProjectionTableRow";

const ProcessProjectionTableRow = memo(
  ({
    processProjection,
    timeRanges,
    isFirstInGroup,
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
  }: {
    processProjection: ProcessProjection;
    timeRanges: TimeRange[];
    isFirstInGroup: boolean;
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
  }) => {
    const job = processProjection.job;
    const hasNotes = jobNotes && jobNotes.length > 0;

    const cellContext: CellRenderContext = {
      job,
      projection: processProjection,
      processProjection,
      isFirstInGroup,
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

    const highlightStyle = hasNotes && noteColor && showNotes && !isSelected && isFirstInGroup
      ? { backgroundColor: hexToRgba(noteColor, 0.08) }
      : undefined;

    return (
      <tr
        className={`cursor-pointer border-l-4 ${
          isSelected ? "bg-blue-100 border-l-blue-500" : "border-l-gray-300"
        } ${isFirstInGroup ? "border-t-2 border-t-gray-400" : ""}`}
        style={highlightStyle}
        onClick={() => onJobClick(job)}
      >
        {orderedColumns.map((col) => (col.isVisible ? renderCell(col.config, cellContext) : null))}
      </tr>
    );
  },
);

ProcessProjectionTableRow.displayName = "ProcessProjectionTableRow";


// Memoized mobile card component
const ProjectionMobileCard = memo(
  ({
    projection,
    timeRanges,
    onJobClick,
    scrollPositions,
    onScrollPositionChange,
    isSelected,
    onToggleSelect,
  }: {
    projection: JobProjection;
    timeRanges: TimeRange[];
    onJobClick: (job: ParsedJob) => void;
    scrollPositions: Map<number, number>;
    onScrollPositionChange: (jobId: number, index: number) => void;
    isSelected: boolean;
    onToggleSelect: () => void;
  }) => {
    const job = projection.job;
    const [localScrollIndex, setLocalScrollIndex] = useState(
      scrollPositions.get(job.id) || 0,
    );
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const VISIBLE_PERIODS = 6;
    const MIN_SWIPE_DISTANCE = 50;

    const handleScrollPrevious = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newIndex = Math.max(0, localScrollIndex - 1);
      setLocalScrollIndex(newIndex);
      onScrollPositionChange(job.id, newIndex);
    };

    const handleScrollNext = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newIndex = Math.min(
        timeRanges.length - VISIBLE_PERIODS,
        localScrollIndex + 1,
      );
      setLocalScrollIndex(newIndex);
      onScrollPositionChange(job.id, newIndex);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
      if (!touchStart || !touchEnd) return;

      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > MIN_SWIPE_DISTANCE;
      const isRightSwipe = distance < -MIN_SWIPE_DISTANCE;

      if (
        isLeftSwipe &&
        localScrollIndex < timeRanges.length - VISIBLE_PERIODS
      ) {
        const newIndex = localScrollIndex + 1;
        setLocalScrollIndex(newIndex);
        onScrollPositionChange(job.id, newIndex);
      }

      if (isRightSwipe && localScrollIndex > 0) {
        const newIndex = localScrollIndex - 1;
        setLocalScrollIndex(newIndex);
        onScrollPositionChange(job.id, newIndex);
      }
    };

    const visibleTimeRanges = timeRanges.slice(
      localScrollIndex,
      localScrollIndex + VISIBLE_PERIODS,
    );

    return (
      <div
        className={`bg-white rounded-lg shadow-sm border p-4 cursor-pointer hover:shadow-md transition-shadow ${
          isSelected
            ? "ring-2 ring-blue-500 bg-blue-50 border-blue-500"
            : "border-[var(--border)]"
        }`}
        onClick={() => onJobClick(job)}
      >
        {/* Selection Checkbox */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <label
            className="flex items-center gap-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-600">Select</span>
          </label>
        </div>

        {/* Job Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-dark)]">
              Job #{job.job_number}
            </div>
            <div className="text-xs text-[var(--text-light)] mt-1">
              {job.client?.name || "Unknown"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--text-light)]">
              Total Quantity
            </div>
            <div className="text-sm font-bold text-[var(--text-dark)]">
              {formatQuantity(projection.totalQuantity)}
            </div>
          </div>
        </div>

        {/* Job Description */}
        <div className="mb-3">
          <div className="text-sm text-[var(--text-dark)] line-clamp-2">
            {job.description || "N/A"}
          </div>
        </div>

        {/* Process Types */}
        <div className="mb-3">
          <div className="text-xs text-[var(--text-light)] mb-1">
            Process Types
          </div>
          <div className="flex flex-wrap gap-1">
            {job.requirements && job.requirements.length > 0 ? (
              [
                ...new Set(
                  job.requirements
                    .map((req) => req.process_type)
                    .filter(Boolean),
                ),
              ].map((processType, idx) => (
                <ProcessTypeBadge
                  key={idx}
                  processType={processType as string}
                />
              ))
            ) : (
              <span className="text-gray-400 text-xs">No processes</span>
            )}
          </div>
        </div>

        {/* Job Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
          <div>
            <div className="text-xs text-[var(--text-light)]">Quantity</div>
            <div className="font-medium text-[var(--text-dark)]">
              {job.quantity.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-light)]">Start Date</div>
            <div className="text-[var(--text-dark)]">
              {job.start_date
                ? new Date(job.start_date).toLocaleDateString()
                : "N/A"}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-[var(--text-light)]">End Date</div>
            <div className="text-[var(--text-dark)]">
              {job.due_date
                ? new Date(job.due_date).toLocaleDateString()
                : "N/A"}
            </div>
          </div>
        </div>

        {/* Time Range Breakdown with navigation */}
        {timeRanges.length > 0 && (
          <div
            className="border-t border-[var(--border)] pt-3"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[var(--text-light)]">
                Period Breakdown
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleScrollPrevious}
                  disabled={localScrollIndex === 0}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous periods"
                >
                  <svg
                    className="w-4 h-4 text-[var(--text-dark)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="text-xs text-[var(--text-light)] min-w-[60px] text-center">
                  {localScrollIndex + 1}-
                  {Math.min(
                    localScrollIndex + VISIBLE_PERIODS,
                    timeRanges.length,
                  )}{" "}
                  of {timeRanges.length}
                </span>
                <button
                  onClick={handleScrollNext}
                  disabled={
                    localScrollIndex + VISIBLE_PERIODS >= timeRanges.length
                  }
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next periods"
                >
                  <svg
                    className="w-4 h-4 text-[var(--text-dark)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {visibleTimeRanges.map((range) => {
                const quantity =
                  projection.weeklyQuantities.get(range.label) || 0;
                const hasValue = quantity > 0;
                const displayValue = formatQuantity(quantity);

                return hasValue ? (
                  <div key={range.label} className="text-center">
                    <div className="text-[var(--text-light)] text-[10px]">
                      {range.label}
                    </div>
                    <div className="font-medium text-[var(--text-dark)]">
                      {displayValue}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    );
  },
);

ProjectionMobileCard.displayName = "ProjectionMobileCard";

// Memoized mobile table row component
const MobileTableRow = memo(
  ({
    projection,
    onJobClick,
    isSelected,
    onToggleSelect,
  }: {
    projection: JobProjection;
    onJobClick: (job: ParsedJob) => void;
    isSelected: boolean;
    onToggleSelect: () => void;
  }) => {
    const job = projection.job;

    return (
      <tr
        className={`cursor-pointer border-b border-[var(--border)] hover:bg-gray-50 ${isSelected ? "bg-blue-100" : ""}`}
        onClick={() => onJobClick(job)}
      >
        <td
          className="pl-2 pr-1 py-2 w-10 sticky left-0 bg-white"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 cursor-pointer"
          />
        </td>
        <td
          className="pl-1 pr-2 py-2 text-xs font-medium text-[var(--text-dark)]"
          title={job.job_number}
        >
          {formatJobNumber(job.job_number)}
        </td>
        <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[80px] truncate">
          {job.facility?.name || "Unknown"}
        </td>
        <td className="px-2 py-2 text-xs text-center font-medium text-[var(--text-dark)]">
          {job.quantity.toLocaleString()}
        </td>
        <td className="px-2 py-2 text-xs text-center font-bold text-[var(--text-dark)] sticky right-0 bg-white">
          {formatQuantity(projection.totalQuantity)}
        </td>
      </tr>
    );
  },
);

MobileTableRow.displayName = "MobileTableRow";

export default function ProjectionsTable({
  timeRanges,
  jobProjections,
  processTypeSummaries,
  onRefresh,
  mobileViewMode = "cards",
  globalTimeScrollIndex = 0,
  onGlobalTimeScrollIndexChange,
  showExpandedProcesses = true,
  showNotes: showNotesProp = false,
  onShowNotesChange,
  granularity = "week",
  fullFilteredProjections,
  lastModifiedByJob,
  versionGroupingEnabled = true,
  serviceTypeLoadData = [],
}: ProjectionsTableProps) {
  const [selectedJob, setSelectedJob] = useState<ParsedJob | null>(null);
  const [selectedJobRelatedVersions, setSelectedJobRelatedVersions] = useState<ParsedJob[]>([]);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("job_number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [cardScrollPositions, setCardScrollPositions] = useState<
    Map<number, number>
  >(new Map());

  // Selection state
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());

  // Bulk actions menu state
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"hard" | "soft" | null>(
    null,
  );
  const bulkMenuRef = useRef<HTMLDivElement>(null);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [isSingleJobNoteModal, setIsSingleJobNoteModal] = useState(false);
  const [selectedCellId, setSelectedCellId] = useState<CellIdentifier | null>(null);

  // View notes toggle state (use prop or default to false)
  const showNotes = showNotesProp;
  const [jobNotesMap, setJobNotesMap] = useState<Map<number, JobNote[]>>(new Map());
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Cell-level notes hook for incremental updates
  const { cellNotesMap, loadNotes: loadCellNotes, cellHasNotes } = useCellNotes();

  // Column settings hook
  const {
    columnSettings,
    isColumnVisible,
    toggleColumnVisibility,
    resetToDefaults: resetColumnSettings,
    setColumnOrder,
    getOrderedColumns,
  } = useColumnSettings();

  // External controls for column visibility (e.g., showNotes prop)
  const externalColumnControls = useMemo(() => ({
    showNotes: showNotes ?? false,
  }), [showNotes]);

  // Get ordered columns with visibility info for unified rendering
  const orderedColumns = useMemo(() => {
    return getOrderedColumns(externalColumnControls);
  }, [getOrderedColumns, externalColumnControls]);

  // Visible static column keys for summary/category rows (excludes dynamic/time columns)
  const visibleStaticColumnKeys = useMemo(() => {
    return orderedColumns
      .filter((col) => col.isVisible && (col.config.type === "static" || col.config.type === "status"))
      .map((col) => col.config.key);
  }, [orderedColumns]);

  // Inline note editing state
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Process type breakdown state
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [expandedPrimaryCategories, setExpandedPrimaryCategories] = useState<Set<string>>(new Set());
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set());
  const [machineVariables, setMachineVariables] = useState<any[]>([]);

  // Version grouping expansion state (versionGroupingEnabled is now a prop)
  const [expandedVersionGroups, setExpandedVersionGroups] = useState<Set<string>>(new Set());

  // Category filter state - tracks which category/breakdown is selected
  const [categoryFilter, setCategoryFilter] = useState<{
    processType: string;
    primaryCategory?: string;     // Tier 2: Basic OE / Envelope Size value
    fieldName?: string;           // For non-size field breakdowns
    fieldValue?: any;             // Field value for non-size fields
    timeRangeLabel?: string;
    // Size filter (stored separately so it can coexist with field filters)
    sizeFilter?: {
      fieldName: string;
      fieldValue: string;
      compositeHeightField?: string; // For composite size fields (width x height)
      compositeHeightValue?: string; // Height value for composite size fields
    };
  } | null>(null);

  // Inside the component, add state for size fields:
  const [sizeFieldsByProcessType, setSizeFieldsByProcessType] = useState<Map<string, SizeField[]>>(new Map());

  // Load machine variables for field definitions
  useEffect(() => {
    getAllMachineVariables()
      .then((variables) => setMachineVariables(variables))
      .catch((err) => console.error("Failed to load machine variables:", err));
  }, []);

  // Add useEffect to fetch size fields when processTypeSummaries change:
  useEffect(() => {
    const fetchSizeFields = async () => {
      if (!processTypeSummaries || processTypeSummaries.length === 0) return;

      const sizeFieldsMap = new Map<string, SizeField[]>();

      await Promise.all(
        processTypeSummaries.map(async (summary) => {
          try {
            // Get jobs for this process type to collect distinct values
            const relevantJobs = jobProjections
              .filter((p) => {
                const jobProcessTypes = getJobProcessTypes(p.job);
                return jobProcessTypes.includes(normalizeProcessType(summary.processType));
              })
              .map((p) => p.job);

            const sizeFields = await getSizeFieldsForProcessTypeCached(
              summary.processType,
              relevantJobs
            );
            sizeFieldsMap.set(summary.processType, sizeFields);
          } catch (error) {
            console.error(`[ProjectionsTable] Error fetching size fields for ${summary.processType}:`, error);
          }
        })
      );

      setSizeFieldsByProcessType(sizeFieldsMap);
    };

    fetchSizeFields();
  }, [processTypeSummaries, jobProjections]);

  // Handler for expansion
  const handleToggleExpand = (processType: string) => {
    setExpandedSummaries((prev) => {
      const next = new Set(prev);
      if (next.has(processType)) {
        next.delete(processType);
      } else {
        next.add(processType);
      }
      return next;
    });
  };

  // Handler for primary category expansion (Tier 2)
  const handleTogglePrimaryCategory = (primaryCategoryKey: string) => {
    setExpandedPrimaryCategories((prev) => {
      const next = new Set(prev);
      if (next.has(primaryCategoryKey)) {
        next.delete(primaryCategoryKey);
      } else {
        next.add(primaryCategoryKey);
      }
      return next;
    });
  };

  // Handler for sub-category expansion (Tier 3)
  const handleToggleSubCategory = (subCategoryKey: string) => {
    setExpandedSubCategories((prev) => {
      const next = new Set(prev);
      if (next.has(subCategoryKey)) {
        next.delete(subCategoryKey);
      } else {
        next.add(subCategoryKey);
      }
      return next;
    });
  };

  // Handlers for expand/collapse all
  const handleExpandAll = () => {
    if (!processTypeSummaries) return;
    const allKeys = new Set<string>();
    processTypeSummaries.forEach((summary) => {
      const summaryKey = isFacilitySummary(summary)
        ? `${summary.processType}-${summary.facilityId}`
        : summary.processType;
      const normalizedProcessType = normalizeProcessType(summary.processType);
      const availableFields = getBreakdownableFields(normalizedProcessType, machineVariables);
      if (availableFields.length > 0) {
        allKeys.add(summaryKey);
      }
    });
    setExpandedSummaries(allKeys);
  };

  const handleCollapseAll = () => {
    setExpandedSummaries(new Set());
  };

  // Handler for version group expansion
  const handleToggleVersionGroup = (groupId: string) => {
    setExpandedVersionGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Handler for tiered category clicks (Tier 2: Primary Category / Basic OE)
  const handleTieredCategoryClick = (
    processType: string,
    primaryCategory: string,
    subField?: string,
    subFieldValue?: string,
    timeRangeLabel?: string
  ) => {
    // Preserve size filter if it exists
    const currentSizeFilter = categoryFilter?.sizeFilter;

    // If clicking the same filter, clear it (but preserve size filter if it exists)
    if (
      categoryFilter &&
      categoryFilter.processType === processType &&
      categoryFilter.primaryCategory === primaryCategory &&
      categoryFilter.fieldName === subField &&
      String(categoryFilter.fieldValue) === String(subFieldValue) &&
      categoryFilter.timeRangeLabel === timeRangeLabel
    ) {
      // If there's a size filter, keep it; otherwise clear everything
      if (currentSizeFilter) {
        setCategoryFilter({
          processType,
          sizeFilter: currentSizeFilter,
        });
      } else {
        setCategoryFilter(null);
      }
      return;
    }

    // Set new filter (include sub-category fields if provided)
    // Preserve size filter if it exists
    setCategoryFilter({
      processType,
      primaryCategory,
      fieldName: subField,
      fieldValue: subFieldValue,
      timeRangeLabel,
      sizeFilter: currentSizeFilter, // Preserve size filter
    });
  };

  // Category filter handlers
  const handleCategoryClick = (
    processType: string,
    fieldName?: string,
    fieldValue?: any,
    timeRangeLabel?: string
  ) => {
    // Preserve size filter if it exists
    const currentSizeFilter = categoryFilter?.sizeFilter;

    // If clicking the same filter, clear it (but preserve size filter if it exists)
    if (
      categoryFilter &&
      categoryFilter.processType === processType &&
      categoryFilter.fieldName === fieldName &&
      categoryFilter.fieldValue === fieldValue &&
      categoryFilter.timeRangeLabel === timeRangeLabel
    ) {
      // If there's a size filter, keep it; otherwise clear everything
      if (currentSizeFilter) {
        setCategoryFilter({
          processType,
          sizeFilter: currentSizeFilter,
        });
      } else {
        setCategoryFilter(null);
      }
      return;
    }

    // Set new filter (preserve size filter)
    setCategoryFilter({
      processType,
      fieldName,
      fieldValue,
      timeRangeLabel,
      sizeFilter: currentSizeFilter, // Preserve size filter
    });
  };

  const handleClearCategoryFilter = () => {
    setCategoryFilter(null);
  };

  // Helper function to compare field values flexibly
  const fieldValuesMatch = (filterValue: any, requirementValue: any): boolean => {
    // Handle undefined/null
    if (filterValue === undefined || filterValue === null) {
      return requirementValue === undefined || requirementValue === null || requirementValue === "";
    }
    if (requirementValue === undefined || requirementValue === null) {
      return filterValue === undefined || filterValue === null || filterValue === "";
    }

    // Handle boolean comparisons
    if (typeof filterValue === "boolean") {
      if (filterValue === true) {
        return requirementValue === true || 
               requirementValue === 1 || 
               String(requirementValue).toLowerCase() === "true" || 
               String(requirementValue) === "1";
      } else {
        return requirementValue === false || 
               requirementValue === 0 || 
               String(requirementValue).toLowerCase() === "false" || 
               String(requirementValue) === "0" || 
               requirementValue === null || 
               requirementValue === undefined || 
               requirementValue === "";
      }
    }

    // Handle number comparisons
    if (typeof filterValue === "number" && typeof requirementValue === "number") {
      return filterValue === requirementValue;
    }

    // String comparison (case-insensitive, trimmed)
    const filterStr = String(filterValue).toLowerCase().trim();
    const valueStr = String(requirementValue).toLowerCase().trim();
    return filterStr === valueStr;
  };

  // Transform data for process view and apply category filter
  const displayProjections = useMemo(() => {
    let projections = jobProjections;

    // Apply category filter if active
    if (categoryFilter) {
      const originalCount = projections.length;
      projections = projections.filter((projection) => {
        const job = projection.job;
        const requirements = job.requirements || [];

        // Check if job has a requirement matching the process type
        const matchingRequirements = requirements.filter((req) => {
          const rawProcessType = req.process_type || "";

          // Always normalize process types for comparison
          const reqProcessType = normalizeProcessType(rawProcessType).toLowerCase();
          const filterProcessType = normalizeProcessType(categoryFilter.processType).toLowerCase();
          const processTypeMatches = reqProcessType === filterProcessType;

          if (!processTypeMatches) {
            return false;
          }

          // Handle tiered filter: primary category (Tier 2)
          if (categoryFilter.primaryCategory) {
            // Check basic_oe first, then paper_size
            const basicOe = (req as any).basic_oe;
            const paperSize = (req as any).paper_size;
            const primaryValue = (basicOe && basicOe !== "" && basicOe !== "undefined" && basicOe !== "null")
              ? String(basicOe)
              : (paperSize && paperSize !== "" && paperSize !== "undefined" && paperSize !== "null")
                ? String(paperSize)
                : undefined;

            // Special handling for "Misc" category - matches jobs WITHOUT a primary category
            if (categoryFilter.primaryCategory === "Misc") {
              if (primaryValue !== undefined) {
                return false;
              }
            } else if (primaryValue !== categoryFilter.primaryCategory) {
              return false;
            }
          }

          // Apply size filter if active (check sizeFilter property)
          if (categoryFilter.sizeFilter) {
            const sizeFilter = categoryFilter.sizeFilter;
            const sizeValue = req[sizeFilter.fieldName];
            
            // Check if this is a composite size filter
            if (sizeFilter.compositeHeightField && sizeFilter.compositeHeightValue) {
              const heightValue = req[sizeFilter.compositeHeightField];
              if (!fieldValuesMatch(sizeFilter.fieldValue, sizeValue) ||
                  !fieldValuesMatch(sizeFilter.compositeHeightValue, heightValue)) {
                return false;
              }
            } else {
              // Regular size field filter
              if (!fieldValuesMatch(sizeFilter.fieldValue, sizeValue)) {
                return false;
              }
            }
          }

          // If filtering by non-size breakdown field, check field value
          if (categoryFilter.fieldName && categoryFilter.fieldValue !== undefined) {
            const fieldValue = req[categoryFilter.fieldName];

            if (!fieldValuesMatch(categoryFilter.fieldValue, fieldValue)) {
              return false;
            }
          }

          return true;
        });

        if (matchingRequirements.length === 0) {
          return false;
        }

        // If filtering by time range, check if job has quantity in that period
        if (categoryFilter.timeRangeLabel) {
          const periodQuantity = projection.weeklyQuantities.get(categoryFilter.timeRangeLabel) || 0;
          if (periodQuantity <= 0) {
            return false;
          }
        }

        return true;
      });

      console.log(`[Category Filter] Filtered from ${originalCount} to ${projections.length} jobs with filter:`, categoryFilter);
    }

    if (showExpandedProcesses) {
      return expandJobProjectionsToProcesses(projections);
    }
    return projections;
  }, [showExpandedProcesses, jobProjections, categoryFilter]);

  const VISIBLE_PERIODS = 3; // For mobile table view

  // Load job notes when toggle is enabled
  const loadJobNotes = async () => {
    setIsLoadingNotes(true);
    try {
      const allNotes = await getJobNotes();

      // Also load cell-level notes
      await loadCellNotes();

      // Create a map of job ID to notes array (job-level notes only)
      const notesMap = new Map<number, JobNote[]>();

      // Filter for job-level notes only (not cell-level notes)
      const validJobNotes = allNotes.filter((note) =>
        note &&
        note.notes &&
        typeof note.notes === 'string' &&
        note.notes.trim().length > 0 &&
        Array.isArray(note.jobs_id) &&
        note.jobs_id.length > 0 &&
        !note.is_cell_note // Exclude cell-level notes from job notes map
      );

      validJobNotes.forEach((note) => {
        note.jobs_id.forEach((jobId) => {
          if (!notesMap.has(jobId)) {
            notesMap.set(jobId, []);
          }
          notesMap.get(jobId)!.push(note);
        });
      });

      setJobNotesMap(notesMap);
    } catch (error) {
      console.error("Failed to load job notes:", error);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Load notes when showNotes becomes true
  useEffect(() => {
    if (showNotes) {
      loadJobNotes();
    } else {
      // Cancel any ongoing edits when hiding notes
      setEditingNoteId(null);
      setEditingText("");
    }
  }, [showNotes]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        bulkMenuRef.current &&
        !bulkMenuRef.current.contains(event.target as Node)
      ) {
        setShowBulkMenu(false);
        setShowStatusSubmenu(false);
      }
    };

    if (showBulkMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showBulkMenu]);

  // Selection handlers
  const handleToggleSelect = (jobId: number) => {
    setSelectedJobIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(sortedJobProjections.map((p) => p.job.id));
      setSelectedJobIds(allIds);
    } else {
      setSelectedJobIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedJobIds(new Set());
    setShowBulkMenu(false);
    setShowStatusSubmenu(false);
    setSelectedStatus(null);
  };

  // Bulk action handlers
  const handleBulkDelete = () => {
    setShowBulkMenu(false);
    setShowDeleteConfirm(true);
  };

  const handleBulkAddNotes = () => {
    setShowBulkMenu(false);
    setIsSingleJobNoteModal(false);
    setShowNotesModal(true);
  };

  const handleOpenNotesModal = (cellId: CellIdentifier) => {
    setSelectedJobIds(new Set([cellId.jobId]));
    setSelectedCellId(cellId);
    setIsSingleJobNoteModal(true);
    setShowNotesModal(true);
  };

  const handleNotesModalClose = () => {
    setShowNotesModal(false);
    // Clear selection only when closing a single-job notes modal (opened via projected numbers click)
    if (isSingleJobNoteModal) {
      setSelectedJobIds(new Set());
      setIsSingleJobNoteModal(false);
    }
  };

  const handleNotesSuccess = () => {
    // Optionally refresh data or show success message
    onRefresh();
    // Reload notes if view notes is enabled
    if (showNotes) {
      loadJobNotes();
    }
  };

  // Toggle view notes
  const handleToggleViewNotes = () => {
    const newShowNotes = !showNotes;
    onShowNotesChange?.(newShowNotes);
    if (newShowNotes) {
      loadJobNotes();
    } else {
      // Cancel any ongoing edits when hiding notes
      setEditingNoteId(null);
      setEditingText("");
    }
  };

  // Inline note editing handlers
  const handleStartEdit = (noteId: number, text: string) => {
    setEditingNoteId(noteId);
    setEditingText(text);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingText("");
  };

  const handleSaveEdit = async (noteId: number) => {
    if (!editingText.trim()) {
      alert("Note cannot be empty.");
      return;
    }

    setIsSavingNote(true);
    try {
      // Find the note to get its jobs_id
      let noteToUpdate: JobNote | undefined;
      for (const notes of jobNotesMap.values()) {
        noteToUpdate = notes.find((n) => n.id === noteId);
        if (noteToUpdate) break;
      }

      if (!noteToUpdate) {
        alert("Note not found. Please refresh and try again.");
        setIsSavingNote(false);
        return;
      }

      await updateJobNote(noteId, {
        jobs_id: noteToUpdate.jobs_id,
        notes: editingText.trim(),
      });

      setEditingNoteId(null);
      setEditingText("");
      await loadJobNotes();
      onRefresh();
    } catch (error) {
      console.error("Failed to update note:", error);
      alert(`Failed to update note: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSavingNote(false);
    }
  };

  const confirmDelete = async () => {
    const count = selectedJobIds.size;
    setIsDeleting(true);

    try {
      const result = await bulkDeleteJobs(Array.from(selectedJobIds));

      setShowDeleteConfirm(false);
      setIsDeleting(false);

      if (result.failures.length > 0) {
        alert(
          `Deleted ${result.success} of ${count} jobs. ${result.failures.length} failed.`,
        );
      } else {
        alert(
          `Successfully deleted ${result.success} job${result.success > 1 ? "s" : ""}`,
        );
      }

      setSelectedJobIds(new Set());
      onRefresh();
    } catch (error) {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      alert("Error deleting jobs. Please try again.");
      console.error("Bulk delete error:", error);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedStatus) return;

    setShowBulkMenu(false);
    setShowStatusSubmenu(false);

    const shouldLock = selectedStatus === "hard";
    await handleBulkLockWeeks(shouldLock);

    setSelectedStatus(null);
  };

  const handleBulkLockWeeks = async (shouldLock: boolean) => {
    const count = selectedJobIds.size;
    const action = shouldLock ? "lock" : "unlock";

    if (
      !confirm(
        `Are you sure you want to ${action} ${count} selected job${count > 1 ? "s" : ""}?`,
      )
    ) {
      return;
    }

    try {
      // Get the selected jobs to update their locked_weeks arrays
      const selectedJobs = sortedJobProjections.filter((p) =>
        selectedJobIds.has(p.job.id),
      );

      const updates = await Promise.allSettled(
        selectedJobs.map(async (projection) => {
          const job = projection.job;
          // Create an array of locked states based on the job's weekly split
          const weeksCount = job.weekly_split?.length || 0;
          const locked_weeks = new Array(weeksCount).fill(shouldLock);

          return bulkUpdateJobs([job.id], { locked_weeks });
        }),
      );

      const successCount = updates.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failureCount = updates.filter(
        (r) => r.status === "rejected",
      ).length;

      if (failureCount > 0) {
        alert(
          `${action === "lock" ? "Locked" : "Unlocked"} ${successCount} of ${count} jobs. ${failureCount} failed.`,
        );
      } else {
        alert(
          `Successfully ${action === "lock" ? "locked" : "unlocked"} ${successCount} job${successCount > 1 ? "s" : ""}`,
        );
      }

      setSelectedJobIds(new Set());
      onRefresh();
    } catch (error) {
      alert(`Error ${action}ing jobs. Please try again.`);
      console.error(`Bulk ${action} error:`, error);
    }
  };

  const handleJobClick = (job: ParsedJob) => {
    setSelectedJob(job);

    // Find related versions from version groups
    const versionGroupUuid = (job as any).version_group_uuid;
    if (versionGroupUuid && versionGroupedData.groups.has(versionGroupUuid)) {
      const group = versionGroupedData.groups.get(versionGroupUuid)!;
      const relatedJobs = group.allVersions.map((v: JobProjection) => v.job);
      setSelectedJobRelatedVersions(relatedJobs);
    } else {
      setSelectedJobRelatedVersions([]);
    }

    setIsJobDetailsOpen(true);
  };

  const handleCloseModal = () => {
    setIsJobDetailsOpen(false);
    setSelectedJob(null);
  };

  const handleCardScrollPositionChange = (jobId: number, index: number) => {
    setCardScrollPositions((prev) => {
      const newMap = new Map(prev);
      newMap.set(jobId, index);
      return newMap;
    });
  };

  const handleGlobalScrollPrevious = () => {
    if (onGlobalTimeScrollIndexChange && globalTimeScrollIndex > 0) {
      onGlobalTimeScrollIndexChange(globalTimeScrollIndex - 1);
    }
  };

  const handleGlobalScrollNext = () => {
    if (
      onGlobalTimeScrollIndexChange &&
      globalTimeScrollIndex < timeRanges.length - VISIBLE_PERIODS
    ) {
      onGlobalTimeScrollIndexChange(globalTimeScrollIndex + 1);
    }
  };

  // Calculate visible time ranges for mobile table view
  const mobileTableVisibleRanges = timeRanges.slice(
    globalTimeScrollIndex,
    globalTimeScrollIndex + VISIBLE_PERIODS,
  );

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort projections (handles both jobs and processes)
  const sortedJobProjections = useMemo(() => {
    if (showExpandedProcesses) {
      const processProjections = displayProjections as ProcessProjection[];
      return [...processProjections].sort((a, b) => {
        let compareValue = 0;

        // Allow sorting by different fields in expanded process view
        switch (sortField) {
          case "process_type":
            // Primary sort by process type
            compareValue = a.processType.localeCompare(b.processType);
            if (compareValue !== 0) {
              return sortDirection === "asc" ? compareValue : -compareValue;
            }
            // Secondary sort by job number
            return a.jobNumber.localeCompare(b.jobNumber);

          case "job_number":
            compareValue = a.jobNumber.localeCompare(b.jobNumber);
            if (compareValue !== 0) {
              return sortDirection === "asc" ? compareValue : -compareValue;
            }
            // Secondary sort by process type
            return a.processType.localeCompare(b.processType);

          case "quantity":
          case "total":
            compareValue = a.totalQuantity - b.totalQuantity;
            break;

          default:
            // Default: group by job, then by process type
            compareValue = a.jobNumber.localeCompare(b.jobNumber);
            if (compareValue !== 0) return compareValue;
            return a.processType.localeCompare(b.processType);
        }

        if (compareValue !== 0) {
          return sortDirection === "asc" ? compareValue : -compareValue;
        }
        return 0;
      });
    }

    // Jobs view - existing sorting logic
    return [...displayProjections].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      const aJob = a as JobProjection;
      const bJob = b as JobProjection;

      switch (sortField) {
        case "job_number":
          aValue = aJob.job.job_number;
          bValue = bJob.job.job_number;
          break;
        case "facility":
          aValue = aJob.job.facility?.name?.toLowerCase() || "";
          bValue = bJob.job.facility?.name?.toLowerCase() || "";
          break;
        case "client":
          aValue = aJob.job.client?.name?.toLowerCase() || "";
          bValue = bJob.job.client?.name?.toLowerCase() || "";
          break;
        case "sub_client":
          aValue = aJob.job.sub_client?.toLowerCase() || "";
          bValue = bJob.job.sub_client?.toLowerCase() || "";
          break;
        case "description":
          aValue = aJob.job.description?.toLowerCase() || "";
          bValue = bJob.job.description?.toLowerCase() || "";
          break;
        case "quantity":
          aValue = aJob.job.quantity;
          bValue = bJob.job.quantity;
          break;
        case "start_date":
          aValue = aJob.job.start_date || 0;
          bValue = bJob.job.start_date || 0;
          break;
        case "due_date":
          aValue = aJob.job.due_date || 0;
          bValue = bJob.job.due_date || 0;
          break;
        case "updated_at":
          aValue = lastModifiedByJob?.get(aJob.job.id) || 0;
          bValue = lastModifiedByJob?.get(bJob.job.id) || 0;
          break;
        case "total":
          aValue = aJob.totalQuantity;
          bValue = bJob.totalQuantity;
          break;
        case "status":
          // Sort by status priority: hard schedule > soft schedule > projected > completed > cancelled
          const getStatusPriority = (job: any): number => {
            const scheduleType = (job.schedule_type || "soft schedule").toLowerCase();
            if (scheduleType.includes("hard")) return 1;
            if (scheduleType.includes("soft")) return 2;
            if (scheduleType.includes("projected")) return 3;
            if (scheduleType.includes("complete")) return 4;
            if (scheduleType.includes("cancel")) return 5;
            return 2; // default to soft schedule
          };
          aValue = getStatusPriority(aJob.job);
          bValue = getStatusPriority(bJob.job);
          break;
        default:
          aValue = aJob.job.job_number;
          bValue = bJob.job.job_number;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [displayProjections, sortField, sortDirection, showExpandedProcesses, lastModifiedByJob]);

  // Calculate selection state
  const allSelected =
    sortedJobProjections.length > 0 &&
    sortedJobProjections.every((p) => selectedJobIds.has(p.job.id));
  const someSelected = sortedJobProjections.some((p) =>
    selectedJobIds.has(p.job.id),
  );
  const selectAllIndeterminate = someSelected && !allSelected;

  // Create header render context for unified column rendering
  const headerRenderContext: HeaderRenderContext = useMemo(() => ({
    allSelected,
    someSelected,
    selectAllIndeterminate,
    onSelectAll: handleSelectAll,
    sortField,
    sortDirection,
    onSort: handleSort,
    timeRanges,
    showExpandedProcesses: showExpandedProcesses ?? false,
    showNotes: showNotes ?? false,
  }), [allSelected, someSelected, selectAllIndeterminate, handleSelectAll, sortField, sortDirection, handleSort, timeRanges, showExpandedProcesses, showNotes]);

  // Calculate total column count for colSpan
  const totalColumnCount = useMemo(() => {
    return calculateColumnCount(orderedColumns, timeRanges.length);
  }, [orderedColumns, timeRanges.length]);

  // Process version grouping for job projections (only in Jobs view, not expanded processes)
  const versionGroupedData = useMemo(() => {
    if (showExpandedProcesses) {
      // Don't apply version grouping to expanded processes view
      return {
        groups: new Map<string, VersionGroup>(),
        standalone: [],
        processedProjections: sortedJobProjections,
      };
    }
    return groupProjectionsByVersion(
      sortedJobProjections as JobProjection[],
      versionGroupingEnabled
    );
  }, [sortedJobProjections, versionGroupingEnabled, showExpandedProcesses]);

  // Add handler for size field clicks:
  const handleSizeFieldClick = (
    processType: string,
    fieldName: string,
    fieldValue: string
  ) => {
    // Check if this is a composite size field (width x height)
    // Composite field names start with "COMPOSITE_"
    if (fieldName.startsWith("COMPOSITE_") && fieldValue.includes("x")) {
      // Extract width and height from the composite value (e.g., "3x3" -> width="3", height="3")
      const [width, height] = fieldValue.split("x");
      
      // Extract the actual field names from the composite field name
      // Format: "COMPOSITE_integer_size_width_integer_size_height" -> width="integer_size_width", height="integer_size_height"
      const withoutPrefix = fieldName.replace("COMPOSITE_", "");
      const parts = withoutPrefix.split("_");
      
      // Find where width and height are in the name
      const widthIndex = parts.findIndex((p, i) => p === "width" && i > 0);
      const heightIndex = parts.findIndex((p, i) => p === "height" && i > 0);
      
      let widthField = "integer_size_width"; // default
      let heightField = "integer_size_height"; // default
      
      if (widthIndex > 0 && heightIndex > 0) {
        // Extract width field: everything up to and including "width"
        widthField = parts.slice(0, widthIndex + 1).join("_");
        // Extract height field: everything up to and including "height"
        heightField = parts.slice(0, heightIndex + 1).join("_");
      } else if (withoutPrefix.includes("integer_size_width") && withoutPrefix.includes("integer_size_height")) {
        widthField = "integer_size_width";
        heightField = "integer_size_height";
      }
      
      setCategoryFilter({
        processType,
        sizeFilter: {
          fieldName: widthField,
          fieldValue: width.trim(),
          compositeHeightField: heightField,
          compositeHeightValue: height.trim(),
        },
        // Preserve existing non-size field filter if it exists
        fieldName: categoryFilter?.fieldName,
        fieldValue: categoryFilter?.fieldValue,
        primaryCategory: categoryFilter?.primaryCategory,
        timeRangeLabel: categoryFilter?.timeRangeLabel,
      });
    } else {
      // Regular size field
      setCategoryFilter({
        processType,
        sizeFilter: {
          fieldName,
          fieldValue,
        },
        // Preserve existing non-size field filter if it exists
        fieldName: categoryFilter?.fieldName,
        fieldValue: categoryFilter?.fieldValue,
        primaryCategory: categoryFilter?.primaryCategory,
        timeRangeLabel: categoryFilter?.timeRangeLabel,
      });
    }
  };

  return (
    <>
      {/* Category Filter Banner */}
      {categoryFilter && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-yellow-900">
              Filtered by:{" "}
              <span className="font-normal">
                {categoryFilter.processType}
                {categoryFilter.sizeFilter && (
                  <> - size: {String(categoryFilter.sizeFilter.fieldValue)}{categoryFilter.sizeFilter.compositeHeightValue ? `x${categoryFilter.sizeFilter.compositeHeightValue}` : ""}</>
                )}
                {categoryFilter.primaryCategory && (
                  <> → {categoryFilter.primaryCategory}</>
                )}
                {categoryFilter.fieldName && categoryFilter.fieldValue !== undefined && (
                  <> - {categoryFilter.fieldName}: {String(categoryFilter.fieldValue)}</>
                )}
                {categoryFilter.timeRangeLabel && (
                  <> - {categoryFilter.timeRangeLabel}</>
                )}
              </span>
            </span>
            <span className="text-sm text-yellow-700">
              ({sortedJobProjections.length} {sortedJobProjections.length === 1 ? "job" : "jobs"} shown)
            </span>
          </div>
          <button
            onClick={handleClearCategoryFilter}
            className="text-sm text-yellow-700 hover:text-yellow-900 underline font-medium"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Bulk Actions Toolbar */}
      {selectedJobIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-blue-900">
              {selectedJobIds.size} {selectedJobIds.size === 1 ? "job" : "jobs"}{" "}
              selected
            </span>
            <button
              onClick={handleClearSelection}
              className="text-sm text-blue-700 hover:text-blue-900 underline"
            >
              Clear selection
            </button>
          </div>
          <div className="relative" ref={bulkMenuRef}>
            <button
              onClick={() => setShowBulkMenu(!showBulkMenu)}
              className="px-4 py-2 rounded font-medium text-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Bulk Actions
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showBulkMenu ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            {showBulkMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                {/* Change Status Option */}
                <div className="border-b border-gray-200">
                  <button
                    onClick={() => setShowStatusSubmenu(!showStatusSubmenu)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Lock className="w-4 h-4" />
                      Change Status
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform ${showStatusSubmenu ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Status Submenu */}
                  {showStatusSubmenu && (
                    <div className="bg-gray-50 px-4 py-3 space-y-3">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            value="hard"
                            checked={selectedStatus === "hard"}
                            onChange={(e) =>
                              setSelectedStatus(e.target.value as "hard")
                            }
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700 flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-green-600" />
                            Hard Scheduled (Lock)
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            value="soft"
                            checked={selectedStatus === "soft"}
                            onChange={(e) =>
                              setSelectedStatus(e.target.value as "soft")
                            }
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700 flex items-center gap-2">
                            <Unlock className="w-3.5 h-3.5 text-gray-600" />
                            Soft Scheduled (Unlock)
                          </span>
                        </label>
                      </div>
                      <button
                        onClick={handleConfirmStatusChange}
                        disabled={!selectedStatus}
                        className="w-full px-3 py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                </div>

                {/* Add Notes Option */}
                <button
                  onClick={handleBulkAddNotes}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-[var(--primary-blue)]" />
                  <span className="text-sm font-medium text-[var(--text-dark)]">
                    Add Notes
                  </span>
                </button>

                {/* Delete Option */}
                <button
                  onClick={handleBulkDelete}
                  className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-2 rounded-b-lg"
                >
                  <Trash className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">
                    Delete Selected
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Controls */}
      <div className="hidden md:flex justify-end mb-3">
        {/* Column Settings */}
        <ColumnSettingsPopover
          columnOrder={columnSettings.order}
          hiddenColumns={columnSettings.hidden}
          onToggleColumn={toggleColumnVisibility}
          onReorderColumns={setColumnOrder}
          onResetToDefaults={resetColumnSettings}
        />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow-sm border border-[var(--border)]">
          <thead>
            {/* Process Type Summary Rows */}
            {processTypeSummaries && processTypeSummaries.length > 0 && (
              <>
                {processTypeSummaries.map((summary, index) => {
                  // Create unique key based on whether it's a facility summary
                  const summaryKey = isFacilitySummary(summary)
                    ? `${summary.processType}-${summary.facilityId}`
                    : summary.processType;

                  const normalizedProcessType = normalizeProcessType(summary.processType);
                  const isExpanded = expandedSummaries.has(summaryKey);

                  // Get available fields for this process type
                  const availableFields = getBreakdownableFields(
                    normalizedProcessType,
                    machineVariables
                  );

                  // Debug logging
                  console.log(`[Breakdown Debug] Process: ${summary.processType}, Normalized: ${normalizedProcessType}, Available Fields:`, availableFields);

                  // Calculate breakdowns for ALL fields if expanded
                  const allBreakdowns: Array<{
                    field: { name: string; label: string; type: string };
                    breakdowns: import("@/types").ProcessTypeBreakdown[];
                  }> = [];

                  if (isExpanded && availableFields.length > 0) {
                    // Filter projections by facility if this is a facility summary
                    const projectionsToUse = fullFilteredProjections || jobProjections;
                    const facilityFilteredProjections = isFacilitySummary(summary)
                      ? projectionsToUse.filter(p => p.job.facilities_id === summary.facilityId)
                      : projectionsToUse;

                    console.log(`[Breakdown Debug] Expanding ${summary.processType}${isFacilitySummary(summary) ? ` (Facility: ${summary.facilityName})` : ''}, using ${facilityFilteredProjections.length} projections (filtered from ${projectionsToUse.length})`);

                    availableFields.forEach((field) => {
                      // Use API data if available, otherwise calculate from projections
                      let fieldBreakdowns: import("@/types").ProcessTypeBreakdown[];
                      
                      if (serviceTypeLoadData.length > 0) {
                        console.log(`[Breakdown Debug] Using API data for field "${field.name}"`);
                        fieldBreakdowns = transformServiceTypeLoadToBreakdowns(
                          serviceTypeLoadData,
                          summary.processType,
                          field.name,
                          timeRanges,
                          granularity,
                        );
                      } else {
                        console.log(`[Breakdown Debug] Calculating breakdowns from projections for field "${field.name}"`);
                        fieldBreakdowns = calculateProcessTypeBreakdownByField(
                          facilityFilteredProjections,
                          timeRanges,
                          normalizedProcessType,
                          field.name
                        );
                      }
                      
                      console.log(`[Breakdown Debug] Field "${field.name}" has ${fieldBreakdowns.length} breakdown entries:`, fieldBreakdowns);
                      // Only include fields that have actual breakdowns (multiple values)
                      if (fieldBreakdowns.length > 0) {
                        allBreakdowns.push({
                          field,
                          breakdowns: fieldBreakdowns,
                        });
                      }
                    });
                    console.log(`[Breakdown Debug] Total breakdowns to display: ${allBreakdowns.length}`);
                  }

                  // For the first row, check if we need expand/collapse all button
                  const isFirstRow = index === 0;
                  let expandCollapseAllButton = null;

                  if (isFirstRow) {
                    // Check if any summaries have breakdowns
                    const summariesWithBreakdowns = processTypeSummaries.filter((s) => {
                      const norm = normalizeProcessType(s.processType);
                      const fields = getBreakdownableFields(norm, machineVariables);
                      return fields.length > 0;
                    });

                    if (summariesWithBreakdowns.length > 0) {
                      // Check if all expandable summaries are expanded
                      const allExpanded = summariesWithBreakdowns.every((s) => {
                        const key = isFacilitySummary(s)
                          ? `${s.processType}-${s.facilityId}`
                          : s.processType;
                        return expandedSummaries.has(key);
                      });

                      expandCollapseAllButton = (
                        <button
                          onClick={allExpanded ? handleCollapseAll : handleExpandAll}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                          title={allExpanded ? "Collapse all summaries" : "Expand all summaries"}
                        >
                          {allExpanded ? (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              <span>Collapse All</span>
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-3 h-3" />
                              <span>Expand All</span>
                            </>
                          )}
                        </button>
                      );
                    }
                  }

                  // Check if this summary row matches the active filter
                  // Only active if filtering by process type only (not by field or size)
                  const isSummaryFilterActive = categoryFilter && 
                    categoryFilter.processType === summary.processType &&
                    !categoryFilter.fieldName &&
                    !categoryFilter.sizeFilter &&
                    !categoryFilter.primaryCategory;

                  // Determine if there's an active size filter for this process type
                  const activeSizeFilter = categoryFilter && 
                    categoryFilter.processType === summary.processType &&
                    categoryFilter.sizeFilter
                    ? {
                        processType: categoryFilter.processType,
                        fieldName: categoryFilter.sizeFilter.fieldName,
                        fieldValue: String(categoryFilter.sizeFilter.fieldValue || ""),
                      }
                    : null;

                  return (
                    <React.Fragment key={summaryKey}>
                      <ProcessTypeSummaryRow
                        summary={summary}
                        timeRanges={timeRanges}
                        showNotes={showNotes}
                        isExpanded={isExpanded}
                        hasBreakdowns={availableFields.length > 0}
                        onToggleExpand={() => handleToggleExpand(summaryKey)}
                        isFacilitySummary={isFacilitySummary(summary)}
                        facilityName={isFacilitySummary(summary) ? summary.facilityName : undefined}
                        expandCollapseAllButton={expandCollapseAllButton}
                        onCategoryClick={handleCategoryClick}
                        onSizeFieldClick={handleSizeFieldClick}
                        isCategoryFilterActive={!!isSummaryFilterActive}
                        visibleStaticColumnKeys={visibleStaticColumnKeys}
                        isColumnVisible={isColumnVisible}
                        sizeFields={sizeFieldsByProcessType.get(summary.processType) || []}
                        activeSizeFilter={activeSizeFilter}
                      />
                      {/* Render tiered category rows (Tier 2: Primary Category / Basic OE) if expanded */}
                      {isExpanded && (() => {
                        // Get projections for this process type
                        let projectionsToUse = fullFilteredProjections || jobProjections;
                        const facilityFilteredProjections = isFacilitySummary(summary)
                          ? projectionsToUse.filter(p => p.job.facilities_id === summary.facilityId)
                          : projectionsToUse;

                        // Apply size filter if active for this process type
                        let filteredProjections = facilityFilteredProjections;
                        if (activeSizeFilter && activeSizeFilter.fieldValue) {
                          filteredProjections = facilityFilteredProjections.filter((proj) => {
                            const requirement = proj.job.requirements?.find(
                              (r: any) => normalizeProcessType(r.process_type) === normalizedProcessType
                            );
                            if (!requirement) return false;
                            
                            const filteredFieldName = activeSizeFilter.fieldName;
                            const filteredValue = activeSizeFilter.fieldValue;
                            
                            // Check if this is a composite size filter
                            if (categoryFilter?.sizeFilter?.compositeHeightField && categoryFilter.sizeFilter.compositeHeightValue) {
                              const widthValue = (requirement as any)[filteredFieldName];
                              const heightValue = (requirement as any)[categoryFilter.sizeFilter.compositeHeightField];
                              return String(widthValue) === categoryFilter.sizeFilter.fieldValue && 
                                     String(heightValue) === categoryFilter.sizeFilter.compositeHeightValue;
                            } else {
                              // Regular size field filter
                              const sizeValue = (requirement as any)[filteredFieldName];
                              return fieldValuesMatch(filteredValue, sizeValue);
                            }
                          });
                        }

                        // Build tiered summary data (only non-size fields will be included)
                        const tieredData = buildSummaryTieredData(
                          filteredProjections,
                          normalizedProcessType,
                          timeRanges,
                          machineVariables
                        );

                        return tieredData.primaryCategories.map((primaryCategory) => {
                          const primaryCategoryKey = `${normalizedProcessType}:${primaryCategory.value}`;
                          const isPrimaryCategoryExpanded = expandedPrimaryCategories.has(primaryCategoryKey);

                          // Check if this primary category row matches the active filter
                          const isPrimaryCategoryFilterActive = categoryFilter &&
                            categoryFilter.processType === normalizedProcessType &&
                            categoryFilter.primaryCategory === primaryCategory.value;

                          // Filter jobs belonging to this primary category when expanded
                          // Also apply size filter if active
                          const categoryJobs = isPrimaryCategoryExpanded
                            ? facilityFilteredProjections.filter((proj) => {
                                const primaryValue = getPrimaryCategoryValue(proj.job, normalizedProcessType);
                                if (primaryCategory.value === "Misc") {
                                  if (primaryValue) return false; // Jobs without primary category
                                } else {
                                  if (primaryValue !== primaryCategory.value) return false;
                                }
                                
                                // Also apply size filter if active
                                if (activeSizeFilter && activeSizeFilter.fieldValue) {
                                  const requirement = proj.job.requirements?.find(
                                    (r: any) => normalizeProcessType(r.process_type) === normalizedProcessType
                                  );
                                  if (!requirement) return false;
                                  
                                  const filteredFieldName = activeSizeFilter.fieldName;
                                  const filteredValue = activeSizeFilter.fieldValue;
                                  
                                  // Check if this is a composite size filter
                                  if (categoryFilter?.sizeFilter?.compositeHeightField && categoryFilter.sizeFilter.compositeHeightValue) {
                                    const widthValue = (requirement as any)[filteredFieldName];
                                    const heightValue = (requirement as any)[categoryFilter.sizeFilter.compositeHeightField];
                                    if (String(widthValue) !== categoryFilter.sizeFilter.fieldValue || 
                                        String(heightValue) !== categoryFilter.sizeFilter.compositeHeightValue) {
                                      return false;
                                    }
                                  } else {
                                    // Regular size field filter
                                    const sizeValue = (requirement as any)[filteredFieldName];
                                    if (!fieldValuesMatch(filteredValue, sizeValue)) {
                                      return false;
                                    }
                                  }
                                }
                                
                                return true;
                              })
                            : [];

                          return (
                            <React.Fragment key={primaryCategoryKey}>
                              <PrimaryCategoryRow
                                category={primaryCategory}
                                processType={normalizedProcessType}
                                timeRanges={timeRanges}
                                showNotes={showNotes}
                                isExpanded={isPrimaryCategoryExpanded}
                                hasSubCategories={primaryCategory.count > 0}
                                onToggleExpand={() => handleTogglePrimaryCategory(primaryCategoryKey)}
                                onCategoryClick={handleTieredCategoryClick}
                                isCategoryFilterActive={!!isPrimaryCategoryFilterActive}
                                visibleStaticColumnKeys={visibleStaticColumnKeys}
                                isColumnVisible={isColumnVisible}
                              />
                              {/* Render sub-category rows when this category is expanded */}
                              {isPrimaryCategoryExpanded && (() => {
                                // Get sub-categories for this primary category
                                const subCategoriesForPrimary = tieredData.subCategories.get(primaryCategory.value) || [];

                                return subCategoriesForPrimary.map((subCategory) => {
                                  const subCategoryKey = `${normalizedProcessType}:${primaryCategory.value}:${subCategory.fieldName}:${subCategory.value}`;
                                  const isSubCategoryExpanded = expandedSubCategories.has(subCategoryKey);

                                  // Check if this sub-category is the active filter
                                  const isSubCategoryFilterActive = categoryFilter &&
                                    categoryFilter.processType === normalizedProcessType &&
                                    categoryFilter.primaryCategory === primaryCategory.value &&
                                    categoryFilter.fieldName === subCategory.fieldName &&
                                    String(categoryFilter.fieldValue) === subCategory.value;

                                  // Filter jobs for this specific sub-category when expanded
                                  // Jobs must match: process type + size filter (if active) + sub-category field value
                                  const subCategoryJobs = isSubCategoryExpanded
                                    ? categoryJobs.filter((proj) => {
                                        const requirement = proj.job.requirements?.find(
                                          (r: any) => normalizeProcessType(r.process_type) === normalizedProcessType
                                        );
                                        if (!requirement) return false;
                                        
                                        // Check sub-category field value
                                        const fieldValue = (requirement as any)[subCategory.fieldName];
                                        if (String(fieldValue) !== subCategory.value) {
                                          return false;
                                        }
                                        
                                        // Also apply size filter if active
                                        if (activeSizeFilter && activeSizeFilter.fieldValue) {
                                          const filteredFieldName = activeSizeFilter.fieldName;
                                          const filteredValue = activeSizeFilter.fieldValue;
                                          
                                  // Check if this is a composite size filter
                                  if (categoryFilter?.sizeFilter?.compositeHeightField && categoryFilter.sizeFilter.compositeHeightValue) {
                                    const widthValue = (requirement as any)[filteredFieldName];
                                    const heightValue = (requirement as any)[categoryFilter.sizeFilter.compositeHeightField];
                                    if (String(widthValue) !== categoryFilter.sizeFilter.fieldValue || 
                                        String(heightValue) !== categoryFilter.sizeFilter.compositeHeightValue) {
                                      return false;
                                    }
                                  } else {
                                    // Regular size field filter
                                    const sizeValue = (requirement as any)[filteredFieldName];
                                    if (!fieldValuesMatch(filteredValue, sizeValue)) {
                                      return false;
                                    }
                                  }
                                        }
                                        
                                        return true;
                                      })
                                    : [];

                                  return (
                                    <React.Fragment key={subCategoryKey}>
                                      <SubCategoryRow
                                        subCategory={subCategory}
                                        processType={normalizedProcessType}
                                        primaryCategory={primaryCategory.value}
                                        timeRanges={timeRanges}
                                        showNotes={showNotes}
                                        isExpanded={isSubCategoryExpanded}
                                        hasJobs={subCategory.count > 0}
                                        onToggleExpand={() => handleToggleSubCategory(subCategoryKey)}
                                        onCategoryClick={handleTieredCategoryClick}
                                        isCategoryFilterActive={!!isSubCategoryFilterActive}
                                        orderedColumnKeys={visibleStaticColumnKeys}
                                        isColumnVisible={isColumnVisible}
                                      />
                                      {/* Render job rows when this sub-category is expanded */}
                                      {isSubCategoryExpanded && subCategoryJobs.map((projection, idx) => {
                                        const jobNotes = showNotes ? jobNotesMap.get(projection.job.id) || [] : [];
                                        const hasNotes = jobNotes.length > 0;
                                        const noteColor = hasNotes ? (jobNotes[0].color || "#000000") : undefined;

                                        return (
                                          <ProjectionTableRow
                                            key={`${subCategoryKey}-job-${projection.job.id}-${idx}`}
                                            projection={projection}
                                            timeRanges={timeRanges}
                                            onJobClick={handleJobClick}
                                            isSelected={selectedJobIds.has(projection.job.id)}
                                            onToggleSelect={() => handleToggleSelect(projection.job.id)}
                                            showNotes={showNotes}
                                            jobNotes={jobNotes}
                                            noteColor={noteColor}
                                            editingNoteId={editingNoteId}
                                            editingText={editingText}
                                            onStartEdit={handleStartEdit}
                                            onCancelEdit={handleCancelEdit}
                                            onSaveEdit={handleSaveEdit}
                                            onTextChange={setEditingText}
                                            isSavingNote={isSavingNote}
                                            onOpenNotesModal={handleOpenNotesModal}
                                            granularity={granularity}
                                            cellNotesMap={cellNotesMap}
                                            orderedColumns={orderedColumns}
                                            lastModifiedByJob={lastModifiedByJob}
                                          />
                                        );
                                      })}
                                    </React.Fragment>
                                  );
                                });
                              })()}
                            </React.Fragment>
                          );
                        });
                      })()}
                      {/* Legacy ProcessTypeBreakdownRow removed - now using 3-tier hierarchy:
                          ProcessTypeSummaryRow -> PrimaryCategoryRow -> SubCategoryRow -> Jobs */}
                    </React.Fragment>
                  );
                })}
              </>
            )}

            {/* Column Headers - rendered dynamically based on column order using unified system */}
            <tr className="bg-gray-50 border-y border-gray-200">
              {orderedColumns.map((col) => {
                if (!col.isVisible) return null;
                return renderColumnHeader(col.config, headerRenderContext);
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {sortedJobProjections.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColumnCount}
                  className="px-4 py-8 text-center text-[var(--text-light)]"
                >
                  No jobs found for the selected criteria
                </td>
              </tr>
            ) : showExpandedProcesses ? (
              // Expanded Process view - each process on its own line, sortable
              (sortedJobProjections as ProcessProjection[]).map(
                (processProjection, index, array) => {
                  // Determine if this is the first row for this job (for visual grouping)
                  const isFirstInGroup =
                    index === 0 ||
                    processProjection.jobId !==
                      (array[index - 1] as ProcessProjection).jobId;
                  
                  const jobNotes = showNotes ? jobNotesMap.get(processProjection.jobId) || [] : [];
                  const hasNotes = jobNotes.length > 0;
                  const noteColor = hasNotes ? (jobNotes[0].color || "#000000") : undefined;

                  return (
                    <ProcessProjectionTableRow
                      key={`${processProjection.jobId}-${processProjection.processType}-${index}`}
                      processProjection={processProjection}
                      timeRanges={timeRanges}
                      isFirstInGroup={isFirstInGroup}
                      onJobClick={handleJobClick}
                      isSelected={selectedJobIds.has(processProjection.jobId)}
                      onToggleSelect={() =>
                        handleToggleSelect(processProjection.jobId)
                      }
                      showNotes={showNotes}
                      jobNotes={isFirstInGroup ? jobNotes : undefined}
                      noteColor={noteColor}
                      editingNoteId={editingNoteId}
                      editingText={editingText}
                      onStartEdit={handleStartEdit}
                      onCancelEdit={handleCancelEdit}
                      onSaveEdit={handleSaveEdit}
                      onTextChange={setEditingText}
                      isSavingNote={isSavingNote}
                      onOpenNotesModal={handleOpenNotesModal}
                      granularity={granularity}
                      cellNotesMap={cellNotesMap}
                      orderedColumns={orderedColumns}
                      lastModifiedByJob={lastModifiedByJob}
                    />
                  );
                },
              )
            ) : (
              // Jobs view or Consolidated view (standard jobs table with version grouping)
              versionGroupedData.processedProjections.map((item, index) => {
                // Check if this item is a VersionGroup or a regular JobProjection
                if (isVersionGroup(item)) {
                  const versionGroup = item as VersionGroup;
                  const isGroupExpanded = expandedVersionGroups.has(versionGroup.groupId);

                  // Render version group header with expandable version rows
                  return (
                    <React.Fragment key={`version-group-${versionGroup.groupId}`}>
                      <VersionGroupHeaderRow
                        versionGroup={versionGroup}
                        timeRanges={timeRanges}
                        isExpanded={isGroupExpanded}
                        onToggleExpand={() => handleToggleVersionGroup(versionGroup.groupId)}
                        onJobClick={handleJobClick}
                        showNotes={showNotes}
                        orderedColumns={orderedColumns}
                        granularity={granularity}
                      />
                      {/* Render individual version rows when expanded */}
                      {isGroupExpanded && versionGroup.allVersions.map((versionProjection, vIdx) => {
                        const vJob = versionProjection.job;
                        const vJobNotes = showNotes ? jobNotesMap.get(vJob.id) || [] : [];
                        const vHasNotes = vJobNotes.length > 0;
                        const vNoteColor = vHasNotes ? vJobNotes[0].color || "#000000" : undefined;

                        return (
                          <VersionRow
                            key={`version-${vJob.id}`}
                            projection={versionProjection}
                            timeRanges={timeRanges}
                            onJobClick={handleJobClick}
                            isSelected={selectedJobIds.has(vJob.id)}
                            onToggleSelect={() => handleToggleSelect(vJob.id)}
                            showNotes={showNotes}
                            jobNotes={vJobNotes}
                            noteColor={vNoteColor}
                            editingNoteId={editingNoteId}
                            editingText={editingText}
                            onStartEdit={handleStartEdit}
                            onCancelEdit={handleCancelEdit}
                            onSaveEdit={handleSaveEdit}
                            onTextChange={setEditingText}
                            isSavingNote={isSavingNote}
                            onOpenNotesModal={handleOpenNotesModal}
                            granularity={granularity}
                            cellNotesMap={cellNotesMap}
                            orderedColumns={orderedColumns}
                            lastModifiedByJob={lastModifiedByJob}
                            isLastInGroup={vIdx === versionGroup.allVersions.length - 1}
                          />
                        );
                      })}
                    </React.Fragment>
                  );
                } else {
                  // Regular JobProjection (standalone or single version)
                  const projection = item as JobProjection;
                  const jobNotes = showNotes
                    ? jobNotesMap.get(projection.job.id) || []
                    : [];
                  const hasNotes = jobNotes.length > 0;
                  const noteColor = hasNotes
                    ? jobNotes[0].color || "#000000"
                    : undefined;

                  return (
                    <ProjectionTableRow
                      key={`job-${projection.job.id}-${index}`}
                      projection={projection}
                      timeRanges={timeRanges}
                      onJobClick={handleJobClick}
                      isSelected={selectedJobIds.has(projection.job.id)}
                      onToggleSelect={() => handleToggleSelect(projection.job.id)}
                      showNotes={showNotes}
                      jobNotes={jobNotes}
                      noteColor={noteColor}
                      editingNoteId={editingNoteId}
                      editingText={editingText}
                      onStartEdit={handleStartEdit}
                      onCancelEdit={handleCancelEdit}
                      onSaveEdit={handleSaveEdit}
                      onTextChange={setEditingText}
                      isSavingNote={isSavingNote}
                      onOpenNotesModal={handleOpenNotesModal}
                      granularity={granularity}
                      cellNotesMap={cellNotesMap}
                      orderedColumns={orderedColumns}
                      lastModifiedByJob={lastModifiedByJob}
                    />
                  );
                }
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {/* Global Time Navigation for Mobile */}
        {mobileViewMode === "table" && timeRanges.length > VISIBLE_PERIODS && (
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--text-light)]">
                Showing Periods
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGlobalScrollPrevious}
                  disabled={globalTimeScrollIndex === 0}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous periods"
                >
                  <svg
                    className="w-5 h-5 text-[var(--text-dark)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="text-sm font-medium text-[var(--text-dark)] min-w-[80px] text-center">
                  {globalTimeScrollIndex + 1}-
                  {Math.min(
                    globalTimeScrollIndex + VISIBLE_PERIODS,
                    timeRanges.length,
                  )}{" "}
                  of {timeRanges.length}
                </span>
                <button
                  onClick={handleGlobalScrollNext}
                  disabled={
                    globalTimeScrollIndex + VISIBLE_PERIODS >= timeRanges.length
                  }
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next periods"
                >
                  <svg
                    className="w-5 h-5 text-[var(--text-dark)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Table View */}
        {mobileViewMode === "table" ? (
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-[var(--border)]">
                <tr>
                  <th className="pl-2 pr-1 py-2 text-left w-10 sticky left-0 bg-gray-50">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = selectAllIndeterminate;
                        }
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="pl-1 pr-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase">
                    Job #
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase">
                    Facility
                  </th>
                  <th className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase">
                    Qty
                  </th>
                  <th className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase sticky right-0 bg-gray-50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedJobProjections.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-[var(--text-light)]"
                    >
                      No jobs found for the selected criteria
                    </td>
                  </tr>
                ) : (
                  sortedJobProjections.map((projection, index) => (
                    <MobileTableRow
                      key={`mobile-${projection.job.id}-${index}`}
                      projection={projection}
                      onJobClick={handleJobClick}
                      isSelected={selectedJobIds.has(projection.job.id)}
                      onToggleSelect={() =>
                        handleToggleSelect(projection.job.id)
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Mobile Card View */
          <div className="space-y-4">
            {sortedJobProjections.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6 text-center text-[var(--text-light)]">
                No jobs found for the selected criteria
              </div>
            ) : (
              sortedJobProjections.map((projection, index) => (
                <ProjectionMobileCard
                  key={`card-${projection.job.id}-${index}`}
                  projection={projection}
                  timeRanges={timeRanges}
                  onJobClick={handleJobClick}
                  scrollPositions={cardScrollPositions}
                  onScrollPositionChange={handleCardScrollPositionChange}
                  isSelected={selectedJobIds.has(projection.job.id)}
                  onToggleSelect={() => handleToggleSelect(projection.job.id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      <JobDetailsModal
        isOpen={isJobDetailsOpen}
        job={selectedJob}
        onClose={handleCloseModal}
        onRefresh={onRefresh}
        relatedVersions={selectedJobRelatedVersions}
      />

      <JobNotesModal
        isOpen={showNotesModal}
        onClose={handleNotesModalClose}
        selectedJobIds={Array.from(selectedJobIds)}
        onSuccess={handleNotesSuccess}
        jobs={jobProjections.map(p => p.job)}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Jobs
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{selectedJobIds.size}</span>{" "}
                selected job{selectedJobIds.size > 1 ? "s" : ""}?
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash className="w-4 h-4" />
                      Delete {selectedJobIds.size} Job
                      {selectedJobIds.size > 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
