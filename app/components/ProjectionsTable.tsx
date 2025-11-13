"use client";

import { useState, memo, useMemo, useEffect, useRef } from "react";
import { ParsedJob } from "@/hooks/useJobs";
import { JobProjection, ServiceTypeSummary } from "@/hooks/useProjections";
import {
  formatQuantity,
  TimeRange,
  ProcessProjection,
  expandJobProjectionsToProcesses,
} from "@/lib/projectionUtils";
import JobDetailsModal from "./JobDetailsModal";
import ProcessTypeBadge from "./ProcessTypeBadge";
import { Trash, Lock, Unlock, ChevronDown } from "lucide-react";
import { bulkDeleteJobs, bulkUpdateJobs } from "@/lib/api";

type SortField =
  | "job_number"
  | "client"
  | "sub_client"
  | "process_type"
  | "description"
  | "quantity"
  | "start_date"
  | "due_date"
  | "total";
type SortDirection = "asc" | "desc";

interface ProjectionsTableProps {
  timeRanges: TimeRange[]; // Can be weeks, months, or quarters
  jobProjections: JobProjection[];
  serviceSummaries: ServiceTypeSummary[];
  grandTotals: {
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  };
  onRefresh: () => void;
  mobileViewMode?: "cards" | "table";
  globalTimeScrollIndex?: number;
  onGlobalTimeScrollIndexChange?: (index: number) => void;
  dataDisplayMode?: "pieces" | "revenue";
  viewMode?: "jobs" | "processes";
  processViewMode?: "consolidated" | "expanded";
}

// Memoized desktop table row component
const ProjectionTableRow = memo(
  ({
    projection,
    timeRanges,
    onJobClick,
    dataDisplayMode,
    isSelected,
    onToggleSelect,
  }: {
    projection: JobProjection;
    timeRanges: TimeRange[];
    onJobClick: (job: ParsedJob) => void;
    dataDisplayMode: "pieces" | "revenue";
    isSelected: boolean;
    onToggleSelect: () => void;
  }) => {
    const job = projection.job;

    return (
      <tr
        key={job.id}
        className={`cursor-pointer ${isSelected ? "bg-blue-100" : ""}`}
        onClick={() => onJobClick(job)}
      >
        <td className="px-2 py-2 w-12" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 cursor-pointer"
          />
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]">
          {job.job_number}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]">
          {job.client?.name || "Unknown"}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-light)]">
          {job.sub_client?.name || "-"}
        </td>
        <td className="px-2 py-2 text-xs text-[var(--text-dark)]">
          <div className="flex flex-wrap gap-1">
            {job.requirements && job.requirements.length > 0 ? (
              // Get unique process types from requirements
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
        </td>
        <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[200px] truncate">
          {job.description || "N/A"}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
          {job.quantity.toLocaleString()}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
          {job.start_date
            ? new Date(job.start_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "N/A"}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
          {job.due_date
            ? new Date(job.due_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "N/A"}
        </td>
        {timeRanges.map((range, index) => {
          const quantity = projection.weeklyQuantities.get(range.label) || 0;
          const revenue = projection.weeklyRevenues.get(range.label) || 0;
          const displayValue =
            dataDisplayMode === "revenue"
              ? revenue.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              : formatQuantity(quantity);

          return (
            <td
              key={range.label}
              className={`px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)] ${
                index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
              }`}
            >
              {displayValue}
            </td>
          );
        })}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-bold text-[var(--text-dark)]">
          {dataDisplayMode === "revenue"
            ? projection.totalRevenue.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })
            : formatQuantity(projection.totalQuantity)}
        </td>
      </tr>
    );
  },
);

ProjectionTableRow.displayName = "ProjectionTableRow";

// Memoized process table row component
const ProcessProjectionTableRow = memo(
  ({
    processProjection,
    timeRanges,
    isFirstInGroup,
    onJobClick,
    dataDisplayMode,
    isSelected,
    onToggleSelect,
  }: {
    processProjection: ProcessProjection;
    timeRanges: TimeRange[];
    isFirstInGroup: boolean;
    onJobClick: (job: ParsedJob) => void;
    dataDisplayMode: "pieces" | "revenue";
    isSelected: boolean;
    onToggleSelect: () => void;
  }) => {
    const job = processProjection.job;

    return (
      <tr
        key={`${job.id}-${processProjection.processType}`}
        className={`cursor-pointer border-l-4 ${
          isSelected ? "bg-blue-100 border-l-blue-500" : "border-l-gray-300"
        } ${isFirstInGroup ? "border-t-2 border-t-gray-400" : ""}`}
        onClick={() => onJobClick(job)}
      >
        {/* Checkbox - only show on first row of group */}
        <td className="px-2 py-2 w-12" onClick={(e) => e.stopPropagation()}>
          {isFirstInGroup && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-4 h-4 cursor-pointer"
            />
          )}
        </td>

        {/* Job details - only show on first row */}
        {isFirstInGroup ? (
          <>
            <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]">
              {job.job_number}
            </td>
            <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]">
              {job.client?.name || "Unknown"}
            </td>
            <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-light)]">
              {job.sub_client?.name || "-"}
            </td>
          </>
        ) : (
          <>
            <td className="px-2 py-2"></td>
            <td className="px-2 py-2"></td>
            <td className="px-2 py-2"></td>
          </>
        )}

        {/* Process Type - single badge */}
        <td className="px-2 py-2 text-xs text-[var(--text-dark)] pl-6">
          <ProcessTypeBadge processType={processProjection.processType} />
        </td>

        {/* Description - only on first row */}
        <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[200px] truncate">
          {isFirstInGroup ? job.description || "N/A" : ""}
        </td>

        {/* Quantity - per process */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
          {processProjection.totalQuantity.toLocaleString()}
        </td>

        {/* Dates - only on first row */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
          {isFirstInGroup && job.start_date
            ? new Date(job.start_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : ""}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
          {isFirstInGroup && job.due_date
            ? new Date(job.due_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : ""}
        </td>

        {/* Time period columns - per process */}
        {timeRanges.map((range, index) => {
          const quantity =
            processProjection.weeklyQuantities.get(range.label) || 0;
          const revenue =
            processProjection.weeklyRevenues.get(range.label) || 0;
          const displayValue =
            dataDisplayMode === "revenue"
              ? revenue.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              : formatQuantity(quantity);

          return (
            <td
              key={range.label}
              className={`px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)] ${
                index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
              }`}
            >
              {displayValue}
            </td>
          );
        })}

        {/* Total - per process */}
        <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-bold text-[var(--text-dark)]">
          {dataDisplayMode === "revenue"
            ? processProjection.totalRevenue.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })
            : formatQuantity(processProjection.totalQuantity)}
        </td>
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
    dataDisplayMode,
    isSelected,
    onToggleSelect,
  }: {
    projection: JobProjection;
    timeRanges: TimeRange[];
    onJobClick: (job: ParsedJob) => void;
    scrollPositions: Map<number, number>;
    onScrollPositionChange: (jobId: number, index: number) => void;
    dataDisplayMode: "pieces" | "revenue";
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
        key={job.id}
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
              {dataDisplayMode === "revenue"
                ? "Total Revenue"
                : "Total Quantity"}
            </div>
            <div className="text-sm font-bold text-[var(--text-dark)]">
              {dataDisplayMode === "revenue"
                ? projection.totalRevenue.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })
                : formatQuantity(projection.totalQuantity)}
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
                const revenue = projection.weeklyRevenues.get(range.label) || 0;
                const hasValue =
                  dataDisplayMode === "revenue" ? revenue > 0 : quantity > 0;
                const displayValue =
                  dataDisplayMode === "revenue"
                    ? revenue.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })
                    : formatQuantity(quantity);

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
    visibleTimeRanges,
    onJobClick,
    dataDisplayMode,
    isSelected,
    onToggleSelect,
  }: {
    projection: JobProjection;
    visibleTimeRanges: TimeRange[];
    onJobClick: (job: ParsedJob) => void;
    dataDisplayMode: "pieces" | "revenue";
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
          className="px-2 py-2 w-12 sticky left-0 bg-white"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 cursor-pointer"
          />
        </td>
        <td className="px-2 py-2 text-xs font-medium text-[var(--text-dark)]">
          {job.job_number}
        </td>
        <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[80px] truncate">
          {job.client?.name || "Unknown"}
        </td>
        {visibleTimeRanges.map((range, index) => {
          const quantity = projection.weeklyQuantities.get(range.label) || 0;
          const revenue = projection.weeklyRevenues.get(range.label) || 0;
          const displayValue =
            dataDisplayMode === "revenue"
              ? revenue.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              : formatQuantity(quantity);

          return (
            <td
              key={range.label}
              className={`px-2 py-2 text-xs text-center font-medium text-[var(--text-dark)] ${
                index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
              }`}
            >
              {displayValue}
            </td>
          );
        })}
        <td className="px-2 py-2 text-xs text-center font-bold text-[var(--text-dark)] sticky right-0 bg-white">
          {dataDisplayMode === "revenue"
            ? projection.totalRevenue.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })
            : formatQuantity(projection.totalQuantity)}
        </td>
      </tr>
    );
  },
);

MobileTableRow.displayName = "MobileTableRow";

export default function ProjectionsTable({
  timeRanges,
  jobProjections,
  onRefresh,
  mobileViewMode = "cards",
  globalTimeScrollIndex = 0,
  onGlobalTimeScrollIndexChange,
  dataDisplayMode = "pieces",
  viewMode = "jobs",
  processViewMode = "consolidated",
}: ProjectionsTableProps) {
  const [selectedJob, setSelectedJob] = useState<ParsedJob | null>(null);
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

  // Transform data for process view
  const displayProjections = useMemo(() => {
    if (viewMode === "processes" && processViewMode === "expanded") {
      return expandJobProjectionsToProcesses(jobProjections);
    }
    return jobProjections;
  }, [viewMode, processViewMode, jobProjections]);

  const VISIBLE_PERIODS = 3; // For mobile table view

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
    if (viewMode === "processes" && processViewMode === "expanded") {
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
            return a.jobNumber - b.jobNumber;

          case "job_number":
            compareValue = a.jobNumber - b.jobNumber;
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
            compareValue = a.jobNumber - b.jobNumber;
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
        case "client":
          aValue = aJob.job.client?.name.toLowerCase() || "";
          bValue = bJob.job.client?.name.toLowerCase() || "";
          break;
        case "sub_client":
          aValue = aJob.job.sub_client?.name.toLowerCase() || "";
          bValue = bJob.job.sub_client?.name.toLowerCase() || "";
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
        case "total":
          aValue = aJob.totalQuantity;
          bValue = bJob.totalQuantity;
          break;
        default:
          aValue = aJob.job.job_number;
          bValue = bJob.job.job_number;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [displayProjections, sortField, sortDirection, viewMode, processViewMode]);

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return <span>{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  // Calculate selection state
  const allSelected =
    sortedJobProjections.length > 0 &&
    sortedJobProjections.every((p) => selectedJobIds.has(p.job.id));
  const someSelected = sortedJobProjections.some((p) =>
    selectedJobIds.has(p.job.id),
  );
  const selectAllIndeterminate = someSelected && !allSelected;

  return (
    <>
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

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow-sm border border-[var(--border)]">
          <thead>
            {/* Column Headers */}
            <tr className="bg-gray-50 border-y border-gray-200">
              <th className="px-2 py-2 text-left w-12">
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
              <th
                onClick={() => handleSort("job_number")}
                className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Job # <SortIcon field="job_number" />
                </div>
              </th>
              <th
                onClick={() => handleSort("client")}
                className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Client <SortIcon field="client" />
                </div>
              </th>
              <th
                onClick={() => handleSort("sub_client")}
                className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Sub Client <SortIcon field="sub_client" />
                </div>
              </th>
              <th
                onClick={() =>
                  viewMode === "processes" && processViewMode === "expanded"
                    ? handleSort("process_type")
                    : undefined
                }
                className={`px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider ${
                  viewMode === "processes" && processViewMode === "expanded"
                    ? "cursor-pointer hover:bg-gray-100"
                    : ""
                }`}
              >
                {viewMode === "processes" && processViewMode === "expanded" ? (
                  <div className="flex items-center gap-1">
                    Process <SortIcon field="process_type" />
                  </div>
                ) : viewMode === "processes" ? (
                  "Process"
                ) : (
                  "Processes"
                )}
              </th>
              <th
                onClick={() => handleSort("description")}
                className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Description <SortIcon field="description" />
                </div>
              </th>
              <th
                onClick={() => handleSort("quantity")}
                className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  Qty <SortIcon field="quantity" />
                </div>
              </th>
              <th
                onClick={() => handleSort("start_date")}
                className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  Start <SortIcon field="start_date" />
                </div>
              </th>
              <th
                onClick={() => handleSort("due_date")}
                className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  End <SortIcon field="due_date" />
                </div>
              </th>
              {timeRanges.map((range, index) => (
                <th
                  key={range.label}
                  className={`px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider ${
                    index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
                  }`}
                >
                  {range.label}
                </th>
              ))}
              <th
                onClick={() => handleSort("total")}
                className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  Total <SortIcon field="total" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {sortedJobProjections.length === 0 ? (
              <tr>
                <td
                  colSpan={10 + timeRanges.length}
                  className="px-4 py-8 text-center text-[var(--text-light)]"
                >
                  No jobs found for the selected criteria
                </td>
              </tr>
            ) : viewMode === "processes" && processViewMode === "expanded" ? (
              // Expanded Process view - each process on its own line, sortable
              (sortedJobProjections as ProcessProjection[]).map(
                (processProjection, index, array) => {
                  // Determine if this is the first row for this job (for visual grouping)
                  const isFirstInGroup =
                    index === 0 ||
                    processProjection.jobId !==
                      (array[index - 1] as ProcessProjection).jobId;

                  return (
                    <ProcessProjectionTableRow
                      key={`${processProjection.jobId}-${processProjection.processType}`}
                      processProjection={processProjection}
                      timeRanges={timeRanges}
                      isFirstInGroup={isFirstInGroup}
                      onJobClick={handleJobClick}
                      dataDisplayMode={dataDisplayMode}
                      isSelected={selectedJobIds.has(processProjection.jobId)}
                      onToggleSelect={() =>
                        handleToggleSelect(processProjection.jobId)
                      }
                    />
                  );
                },
              )
            ) : (
              // Jobs view or Consolidated view (standard jobs table)
              (sortedJobProjections as JobProjection[]).map((projection) => (
                <ProjectionTableRow
                  key={projection.job.id}
                  projection={projection}
                  timeRanges={timeRanges}
                  onJobClick={handleJobClick}
                  dataDisplayMode={dataDisplayMode}
                  isSelected={selectedJobIds.has(projection.job.id)}
                  onToggleSelect={() => handleToggleSelect(projection.job.id)}
                />
              ))
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
                  <th className="px-2 py-2 text-left w-12 sticky left-0 bg-gray-50">
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
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase">
                    Job #
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase">
                    Client
                  </th>
                  {mobileTableVisibleRanges.map((range, index) => (
                    <th
                      key={range.label}
                      className={`px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase ${
                        index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
                      }`}
                    >
                      {range.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase sticky right-0 bg-gray-50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedJobProjections.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6 + VISIBLE_PERIODS}
                      className="px-4 py-8 text-center text-[var(--text-light)]"
                    >
                      No jobs found for the selected criteria
                    </td>
                  </tr>
                ) : (
                  sortedJobProjections.map((projection) => (
                    <MobileTableRow
                      key={projection.job.id}
                      projection={projection}
                      visibleTimeRanges={mobileTableVisibleRanges}
                      onJobClick={handleJobClick}
                      dataDisplayMode={dataDisplayMode}
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
              sortedJobProjections.map((projection) => (
                <ProjectionMobileCard
                  key={projection.job.id}
                  projection={projection}
                  timeRanges={timeRanges}
                  onJobClick={handleJobClick}
                  scrollPositions={cardScrollPositions}
                  onScrollPositionChange={handleCardScrollPositionChange}
                  dataDisplayMode={dataDisplayMode}
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
