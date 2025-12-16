"use client";

import { useEffect, useState } from "react";
import { type ParsedJob } from "@/hooks/useJobs";
import { deleteJob, updateJob, getToken } from "@/lib/api";
import { getProcessTypeConfig } from "@/lib/processTypeConfig";
import Toast from "./Toast";
import JobRevisionHistoryModal from "./JobRevisionHistoryModal";
import EditJobModal from "./EditJobModal";
import QuantitySplitEditor, { SplitResultItem } from "./QuantitySplitEditor";

interface JobDetailsModalProps {
  isOpen: boolean;
  job: ParsedJob | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function JobDetailsModal({
  isOpen,
  job,
  onClose,
  onRefresh,
}: JobDetailsModalProps) {
  const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'details' | 'edit'>('details');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const [deletedJobNumber, setDeletedJobNumber] = useState<string | null>(null);

  // Split editing state
  const [isEditingSplit, setIsEditingSplit] = useState(false);
  const [splitResults, setSplitResults] = useState<SplitResultItem[]>([]);
  const [lockedSplitWeeks, setLockedSplitWeeks] = useState<Record<number, boolean>>({});
  const [isSavingSplit, setIsSavingSplit] = useState(false);
  const [loadingSplit, setLoadingSplit] = useState(false);

  // Version management state
  const [versions, setVersions] = useState<ParsedJob[]>([]);
  const [displayedJob, setDisplayedJob] = useState<ParsedJob | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Sync displayedJob when job prop changes
  useEffect(() => {
    if (job) {
      setDisplayedJob(job);
    }
  }, [job]);

  // Fetch versions when modal opens and job has version_group_uuid
  useEffect(() => {
    const fetchVersions = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const versionGroupUuid = (job as any)?.version_group_uuid;
      if (!versionGroupUuid || !isOpen) return;

      setLoadingVersions(true);
      try {
        const token = await getToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs?version_group_uuid=${versionGroupUuid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          // Parse the jobs similar to how useJobs does it
          if (Array.isArray(data)) {
            setVersions(data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch versions:", error);
      } finally {
        setLoadingVersions(false);
      }
    };
    fetchVersions();
  }, [job, isOpen]);

  // Handle version switch
  const handleVersionSwitch = (versionJob: ParsedJob) => {
    setDisplayedJob(versionJob);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !job) return null;

  // Use displayedJob for rendering (supports version switching), fall back to job
  const currentJob = displayedJob || job;

  // Helper function to format currency values
  const formatCurrency = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === "") return "N/A";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return String(value);
    return `$${numValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Helper function to check if a field is a cost field
  const isCostField = (fieldName: string): boolean => {
    return (
      fieldName === "price_per_m" ||
      fieldName.endsWith("_cost") ||
      fieldName.toLowerCase().includes("price") ||
      fieldName.toLowerCase().includes("cost")
    );
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const jobNum = job.job_number;
      const jobIdValue = job.id;

      // Validation check
      if (!jobIdValue || jobIdValue === 0) {
        throw new Error(`Invalid job ID: ${jobIdValue}`);
      }

      await deleteJob(jobIdValue);

      setShowDeleteConfirm(false);
      setDeletedJobNumber(jobNum);
      setShowDeleteToast(true);
      onClose();

      // Delay refresh to show toast
      setTimeout(() => {
        if (onRefresh) {
          onRefresh();
        }
      }, 500);
    } catch (error) {
      console.error("Error deleting job:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      alert(
        `Failed to delete job #${job.job_number}.\n\nError: ${errorMessage}\n\nPlease check the console for details or contact support.`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  // Start editing split - fetch split data from API
  const handleStartEditSplit = async () => {
    if (!job) return;

    setLoadingSplit(true);
    setIsEditingSplit(true);

    try {
      const token = await getToken();

      // Format dates for the API
      const formatDate = (timestamp: number | null | undefined) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toISOString().split("T")[0];
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/calculate-split`,
        {
          method: "POST",
          body: JSON.stringify({
            quantity: job.quantity,
            start_date: formatDate(job.start_date),
            due_date: formatDate(job.due_date),
            run_saturdays: false,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to calculate split: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      setSplitResults(data);
      setLockedSplitWeeks({});
    } catch (error) {
      console.error("Error fetching split data:", error);
      alert("Failed to load split data. Please try again.");
      setIsEditingSplit(false);
    } finally {
      setLoadingSplit(false);
    }
  };

  // Cancel split editing
  const handleCancelEditSplit = () => {
    setIsEditingSplit(false);
    setSplitResults([]);
    setLockedSplitWeeks({});
  };

  // Save split changes
  const handleSaveSplit = async () => {
    if (!job || splitResults.length === 0) return;

    setIsSavingSplit(true);

    try {
      // Group splitResults by week and track first date for each week (for chronological sorting)
      const weeklyData: Record<number, Record<number, number>> = {};
      const weekFirstDates: Record<number, string> = {};
      splitResults.forEach((item) => {
        if (!weeklyData[item.CalendarWeek]) {
          weeklyData[item.CalendarWeek] = {};
          weekFirstDates[item.CalendarWeek] = item.Date;
        }
        weeklyData[item.CalendarWeek][item.CalendarDayInWeek] = item.Quantity;
        // Track the earliest date for each week
        if (item.Date < weekFirstDates[item.CalendarWeek]) {
          weekFirstDates[item.CalendarWeek] = item.Date;
        }
      });

      // Sort weeks chronologically by date (handles year boundaries correctly)
      const sortedWeeks = Object.keys(weeklyData)
        .map(Number)
        .sort((a, b) => {
          const dateA = new Date(weekFirstDates[a]);
          const dateB = new Date(weekFirstDates[b]);
          return dateA.getTime() - dateB.getTime();
        });

      // Convert to daily_split format: 2D array where each sub-array is a week with 7 days (Mon-Sun)
      const dailySplit: number[][] = sortedWeeks.map((week) => {
        const weekData = weeklyData[week];
        // Days 1-7 represent Mon-Sun
        return [1, 2, 3, 4, 5, 6, 7].map((day) => weekData[day] || 0);
      });

      // Calculate weekly_split from splitResults
      const weeklyTotals: Record<number, number> = {};
      splitResults.forEach((item) => {
        if (!weeklyTotals[item.CalendarWeek]) {
          weeklyTotals[item.CalendarWeek] = 0;
        }
        weeklyTotals[item.CalendarWeek] += item.Quantity;
      });
      // Use same chronological ordering for weekly split
      const weeklySplit = sortedWeeks.map((week) => weeklyTotals[week]);

      // Convert lockedSplitWeeks to locked_weeks array (same chronological order)
      const lockedWeeks = sortedWeeks.map((week) => lockedSplitWeeks[week] || false);

      await updateJob(job.id, {
        daily_split: dailySplit,
        weekly_split: weeklySplit,
        locked_weeks: lockedWeeks,
      });

      setIsEditingSplit(false);
      setSplitResults([]);
      setLockedSplitWeeks({});

      // Refresh job data
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error saving split:", error);
      alert("Failed to save split. Please try again.");
    } finally {
      setIsSavingSplit(false);
    }
  };

  // Transition handlers for edit mode
  const handleEditClick = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode('edit');
      setIsTransitioning(false);
    }, 250);
  };

  const handleBackToDetails = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode('details');
      setIsTransitioning(false);
    }, 250);
  };

  const handleEditSuccess = () => {
    handleBackToDetails();
    if (onRefresh) onRefresh();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`bg-white rounded-xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col relative z-10 transition-all duration-500 ease-in-out ${viewMode === 'edit' ? 'max-w-3xl' : 'max-w-6xl'}`}>
        {/* Fade transition wrapper */}
        <div className={`flex-1 flex flex-col min-h-0 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {viewMode === 'edit' ? (
            <EditJobModal
              isOpen={true}
              job={job}
              onClose={onClose}
              onBack={handleBackToDetails}
              onSuccess={handleEditSuccess}
              embedded={true}
            />
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border)]">
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
                  Job Details
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
                >
                  &times;
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Two-Column Layout: Job Information | Assignment & Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Job Information */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
                Job Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Job Number
                  </label>
                  <p className="text-base text-[var(--text-dark)]">
                    {currentJob.job_number}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Facility
                  </label>
                  <p className="text-base text-[var(--text-dark)]">
                    {currentJob.facilities_id === 1
                      ? "Bolingbrook"
                      : currentJob.facilities_id === 2
                        ? "Lemont"
                        : "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Job Name
                  </label>
                  <p className="text-base text-[var(--text-dark)]">
                    {currentJob.job_name || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Client
                  </label>
                  <p className="text-base text-[var(--text-dark)]">
                    {currentJob.client?.name || "Unknown"}
                  </p>
                </div>
                {currentJob.sub_client && (
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                      Sub Client
                    </label>
                    <p className="text-base text-[var(--text-dark)]">
                      {currentJob.sub_client}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Service Type
                  </label>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    {currentJob.service_type}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Quantity
                  </label>
                  <p className="text-base text-[var(--text-dark)]">
                    {currentJob.quantity.toLocaleString()}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Description
                  </label>
                  <p className="text-base text-[var(--text-dark)]">
                    {currentJob.description || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Assignment & Timeline (stacked) */}
            <div className="space-y-4">
              {/* Assignment Section */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
                  Assignment
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                      CSR
                    </label>
                    <p className="text-base text-[var(--text-dark)]">
                      {currentJob.csr || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                      Program Cadence
                    </label>
                    <p className="text-base text-[var(--text-dark)]">
                      {currentJob.prgm || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timeline Section */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
                  Timeline
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                      Start Date
                    </label>
                    <p className="text-base text-[var(--text-dark)]">
                      {currentJob.start_date
                        ? new Date(currentJob.start_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "numeric",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                      Due Date
                    </label>
                    <p className="text-base text-[var(--text-dark)]">
                      {currentJob.due_date
                        ? new Date(currentJob.due_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "numeric",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                      Time Estimate
                    </label>
                    <p className="text-base text-[var(--text-dark)]">
                      {currentJob.time_estimate ? `${currentJob.time_estimate} hours` : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Quantity Distribution (Full Width) */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {((currentJob as any).weekly_split && (currentJob as any).weekly_split.length > 0) || isEditingSplit ? (
            <div>
              {isEditingSplit ? (
                // Editing mode - show QuantitySplitEditor
                <div className="space-y-4">
                  {loadingSplit ? (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-[var(--primary-blue)]">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="font-medium">Loading split data...</span>
                      </div>
                    </div>
                  ) : splitResults.length > 0 ? (
                    <QuantitySplitEditor
                      splitResults={splitResults}
                      lockedWeeks={lockedSplitWeeks}
                      totalQuantity={currentJob.quantity}
                      onSplitChange={setSplitResults}
                      onLockedWeeksChange={setLockedSplitWeeks}
                    />
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelEditSplit}
                      disabled={isSavingSplit}
                      className="px-4 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSplit}
                      disabled={isSavingSplit || splitResults.length === 0}
                      className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isSavingSplit ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                // Read-only mode
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-[var(--dark-blue)]">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      Weekly Quantity Distribution (
                      {(currentJob as any).weekly_split.length}{" "}
                      {(currentJob as any).weekly_split.length === 1
                        ? "week"
                        : "weeks"}
                      )
                    </h4>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-[var(--text-dark)]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        Total:{" "}
                        {(currentJob as any).weekly_split
                          .reduce((sum: number, qty: number) => sum + qty, 0)
                          .toLocaleString()}
                      </div>
                      <button
                        onClick={handleStartEditSplit}
                        className="px-3 py-1 text-sm bg-[var(--primary-blue)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                      >
                        Edit Split
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(currentJob as any).weekly_split.map(
                      (qty: number, index: number) => (
                        <div
                          key={index}
                          className="bg-white rounded-md p-3 border border-gray-200"
                        >
                          <div className="text-xs font-medium text-[var(--text-light)] mb-1">
                            Week {index + 1}
                          </div>
                          <div className="text-base font-semibold text-[var(--text-dark)]">
                            {qty.toLocaleString()}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Two-Column Layout: Versions | Services */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 border-t border-[var(--border)] pt-6">
            {/* Left: Versions (1/3 width) */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
                Versions
              </h3>
              <div className="space-y-2">
                {loadingVersions ? (
                  <div className="flex items-center gap-2 text-[var(--text-light)]">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm">Loading versions...</span>
                  </div>
                ) : versions.length > 1 ? (
                  // Multiple versions available - show all with radio selection
                  <div className="space-y-2">
                    {versions.map((version) => {
                      const isSelected = displayedJob?.id === version.id;
                      const isOriginal = version.id === job?.id;
                      return (
                        <button
                          key={version.id}
                          onClick={() => handleVersionSwitch(version)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
                            isSelected
                              ? "bg-blue-50 border border-blue-200"
                              : "bg-white border border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full ${
                              isSelected ? "bg-blue-500" : "bg-gray-300"
                            }`}
                          ></div>
                          <span className={`text-sm font-medium ${isSelected ? "text-[var(--primary-blue)]" : "text-[var(--text-dark)]"}`}>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(version as any).version_name || `v${version.id}`}
                            {isOriginal && " (original)"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  // Single version
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium text-[var(--text-dark)]">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(displayedJob as any)?.version_name || "v1"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Services (2/3 width) */}
            <div className="lg:col-span-2 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
                Services
              </h3>
              {(() => {
                // Defensive parsing: handle cases where requirements might still be a string
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let parsedRequirements: any[] = [];

                if (currentJob.requirements) {
                  if (Array.isArray(currentJob.requirements)) {
                    parsedRequirements = currentJob.requirements;
                  } else {
                    // Type assertion needed because ParsedJob types requirements as array,
                    // but at runtime it might still be a string in some cases
                    const requirementsStr = currentJob.requirements as unknown as string;
                    if (typeof requirementsStr === "string") {
                      try {
                        // Try parsing as JSON string
                        if (requirementsStr.trim().startsWith("[")) {
                          parsedRequirements = JSON.parse(requirementsStr);
                        } else if (requirementsStr.trim().startsWith("{")) {
                          // Handle single object wrapped in braces
                          parsedRequirements = [JSON.parse(requirementsStr)];
                        }
                      } catch (error) {
                        console.error(
                          "[JobDetailsModal] Failed to parse requirements:",
                          error,
                          requirementsStr,
                        );
                        parsedRequirements = [];
                      }
                    }
                  }
                }

                console.log("[JobDetailsModal] Requirements debug:", {
                  jobId: currentJob.id,
                  jobNumber: currentJob.job_number,
                  rawRequirements: currentJob.requirements,
                  parsedRequirements,
                  isArray: Array.isArray(currentJob.requirements),
                  type: typeof currentJob.requirements,
                });

                if (parsedRequirements && parsedRequirements.length > 0) {
                  return (
                    <div className="space-y-4">
                      {parsedRequirements.map((req, index) => {
                        // Get the process type configuration
                        const processConfig = getProcessTypeConfig(req.process_type);

                        // Get all fields for this process type, excluding process_type (shown in header)
                        const fieldsToDisplay =
                          processConfig?.fields.filter(
                            (field) => field.name !== "process_type",
                          ) || [];

                        // Get all keys from the requirement object to show any fields not in config
                        const allReqKeys = Object.keys(req).filter(
                          (key) =>
                            key !== "process_type" &&
                            req[key] !== undefined &&
                            req[key] !== null &&
                            req[key] !== "",
                        );
                        const configFieldNames = new Set(
                          fieldsToDisplay.map((f) => f.name),
                        );
                        const additionalFields = allReqKeys.filter(
                          (key) => !configFieldNames.has(key),
                        );

                        return (
                          <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                            <h4 className="text-sm font-semibold text-[var(--dark-blue)] mb-3">
                              Service {index + 1}:{" "}
                              {processConfig?.label || req.process_type || "Unknown"}
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              {fieldsToDisplay.map((fieldConfig) => {
                                const fieldValue =
                                  req[fieldConfig.name as keyof typeof req];

                                // Skip if field has no value
                                if (
                                  fieldValue === undefined ||
                                  fieldValue === null ||
                                  fieldValue === ""
                                ) {
                                  return null;
                                }

                                // Format the value based on field type
                                let displayValue: string;
                                if (fieldConfig.type === "currency") {
                                  displayValue = formatCurrency(fieldValue);
                                } else {
                                  displayValue = String(fieldValue);
                                }

                                return (
                                  <div key={fieldConfig.name}>
                                    <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                                      {fieldConfig.label}
                                    </label>
                                    <p className="text-base text-[var(--text-dark)]">
                                      {displayValue}
                                    </p>
                                  </div>
                                );
                              })}

                              {/* Show additional fields that aren't in the process type config */}
                              {additionalFields.map((fieldName) => {
                                const fieldValue = req[fieldName];
                                if (
                                  fieldValue === undefined ||
                                  fieldValue === null ||
                                  fieldValue === ""
                                ) {
                                  return null;
                                }

                                // Format as currency if it's a cost field
                                const displayValue = isCostField(fieldName)
                                  ? formatCurrency(fieldValue)
                                  : String(fieldValue);

                                return (
                                  <div key={fieldName}>
                                    <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                                      {fieldName
                                        .replace(/_/g, " ")
                                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                                    </label>
                                    <p className="text-base text-[var(--text-dark)]">
                                      {displayValue}
                                    </p>
                                  </div>
                                );
                              })}

                              {/* Show "No additional details" if no fields to display */}
                              {fieldsToDisplay.length === 0 &&
                                additionalFields.length === 0 && (
                                  <div className="col-span-2 text-sm text-[var(--text-light)] italic">
                                    No additional service details
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <p className="text-base text-[var(--text-light)]">
                    No services configured
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Pricing Section (Full Width at Bottom) */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Pricing
            </h3>
            {currentJob.requirements && currentJob.requirements.length > 0 ? (
              <div className="space-y-3">
                {/* Revenue per Process */}
                {(() => {
                  // Debug logging
                  console.log("[JobDetailsModal] Job data:", {
                    jobNumber: currentJob.job_number,
                    quantity: currentJob.quantity,
                    total_billing: currentJob.total_billing,
                    add_on_charges: currentJob.add_on_charges,
                    requirements: currentJob.requirements,
                  });

                  // Helper function to calculate revenue from a requirement
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const calculateRequirementRevenue = (req: any) => {
                    // Handle "undefined" string, null, undefined, and empty string
                    const pricePerMStr = req.price_per_m;
                    const isValidPrice =
                      pricePerMStr &&
                      pricePerMStr !== "undefined" &&
                      pricePerMStr !== "null";
                    const pricePerM = isValidPrice
                      ? parseFloat(pricePerMStr)
                      : 0;
                    const baseRevenue = (currentJob.quantity / 1000) * pricePerM;

                    // Calculate additional field costs (price per 1000)
                    const additionalCosts = Object.keys(req)
                      .filter((key) => key.endsWith("_cost"))
                      .reduce((costTotal, costKey) => {
                        const costValue = parseFloat(String(req[costKey] || "0")) || 0;
                        return costTotal + (currentJob.quantity / 1000) * costValue;
                      }, 0);

                    return baseRevenue + additionalCosts;
                  };

                  // Calculate total revenue from requirements
                  const requirementsTotal = currentJob.requirements.reduce(
                    (total, req) => {
                      console.log(
                        `[JobDetailsModal] Requirement ${req.process_type}: price_per_m="${req.price_per_m}"`,
                      );
                      return total + calculateRequirementRevenue(req);
                    },
                    0,
                  );

                  // Get the actual total billing
                  const totalBilling = parseFloat(currentJob.total_billing || "0");
                  const addOnCharges = parseFloat(currentJob.add_on_charges || "0");
                  const revenueWithoutAddOns = totalBilling - addOnCharges;

                  console.log("[JobDetailsModal] Calculations:", {
                    requirementsTotal,
                    totalBilling,
                    addOnCharges,
                    revenueWithoutAddOns,
                  });

                  // If requirements don't have price_per_m but we have total_billing, distribute it
                  const shouldDistribute =
                    revenueWithoutAddOns > 0 && requirementsTotal === 0;

                  return currentJob.requirements.map((req, index) => {
                    let processRevenue = calculateRequirementRevenue(req);

                    // Distribute revenue if price_per_m is missing
                    if (shouldDistribute) {
                      // If only one requirement, give it all the revenue
                      if (currentJob.requirements.length === 1) {
                        processRevenue = revenueWithoutAddOns;
                      } else {
                        // Distribute evenly across all requirements
                        processRevenue =
                          revenueWithoutAddOns / currentJob.requirements.length;
                      }
                    }

                    return (
                      <div
                        key={index}
                        className="flex justify-between items-center py-2"
                      >
                        <span className="text-sm text-[var(--text-dark)]">
                          Revenue from {req.process_type}:
                        </span>
                        <span className="text-base font-semibold text-[var(--text-dark)]">
                          $
                          {processRevenue.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    );
                  });
                })()}

                {/* Add-On Charges */}
                {currentJob.add_on_charges && parseFloat(currentJob.add_on_charges) > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-[var(--text-dark)]">
                      Add-on Charges:
                    </span>
                    <span className="text-base font-semibold text-[var(--text-dark)]">
                      $
                      {parseFloat(currentJob.add_on_charges).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

                {/* Total Revenue */}
                {(() => {
                  // Calculate total revenue from requirements (including additional costs)
                  const calculatedTotalRevenue =
                    currentJob.requirements.reduce((total, req) => {
                      const pricePerMStr = req.price_per_m;
                      const isValidPrice =
                        pricePerMStr &&
                        pricePerMStr !== "undefined" &&
                        pricePerMStr !== "null";
                      const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
                      const baseRevenue = (currentJob.quantity / 1000) * pricePerM;

                      // Calculate additional field costs (price per 1000)
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const additionalCosts = Object.keys(req as any)
                        .filter((key) => key.endsWith("_cost"))
                        .reduce((costTotal, costKey) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const costValue = parseFloat(String((req as any)[costKey] || "0")) || 0;
                          return costTotal + (currentJob.quantity / 1000) * costValue;
                        }, 0);

                      return total + baseRevenue + additionalCosts;
                    }, 0) + parseFloat(currentJob.add_on_charges || "0");

                  return (
                    <div className="flex justify-between items-center py-3 border-t-2 border-[var(--primary-blue)] mt-3">
                      <span className="text-base font-bold text-[var(--text-dark)]">
                        Total Revenue:
                      </span>
                      <span className="text-xl font-bold text-[var(--primary-blue)]">
                        $
                        {calculatedTotalRevenue.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  );
                })()}

                {/* Revenue per Unit */}
                <div className="flex justify-between items-center py-2 bg-white rounded-lg px-4">
                  <span className="text-sm text-[var(--text-dark)]">
                    Revenue per Unit:
                  </span>
                  <span className="text-base font-semibold text-[var(--text-dark)]">
                    $
                    {currentJob.quantity > 0
                      ? (
                          (parseFloat(currentJob.total_billing || "0") ||
                            currentJob.requirements.reduce((total, req) => {
                              const pricePerM = parseFloat(
                                req.price_per_m || "0",
                              );
                              return total + (currentJob.quantity / 1000) * pricePerM;
                            }, 0) + parseFloat(currentJob.add_on_charges || "0")) /
                          currentJob.quantity
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4,
                        })
                      : "0.0000"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-base text-[var(--text-light)]">
                <p>No pricing information available.</p>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="border-t border-[var(--border)] p-4 sm:p-6 flex justify-between gap-3 bg-white shrink-0">
          <button
            onClick={handleDeleteClick}
            className="px-6 py-2 border-2 border-red-500 text-red-500 rounded-lg font-semibold hover:bg-red-50 transition-colors"
          >
            Delete Job
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setIsRevisionHistoryOpen(true)}
              className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
            >
              Revision History
            </button>
            <button
              onClick={handleEditClick}
              disabled={isTransitioning}
              className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isTransitioning ? "Loading..." : "Edit Job"}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleDeleteCancel}
          />
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative z-10">
            <h3 className="text-xl font-bold text-[var(--dark-blue)] mb-4">
              Confirm Delete
            </h3>
            <p className="text-[var(--text-dark)] mb-6">
              Are you sure you want to delete{" "}
              <strong>Job #{job.job_number}</strong>? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision History Modal */}
      <JobRevisionHistoryModal
        isOpen={isRevisionHistoryOpen}
        onClose={() => setIsRevisionHistoryOpen(false)}
        jobId={job.id}
        jobNumber={job.job_number}
        jobName={job.job_name}
      />


      {/* Success Toasts */}
      {showDeleteToast && deletedJobNumber && (
        <Toast
          message={`Job #${deletedJobNumber} deleted successfully!`}
          type="success"
          onClose={() => setShowDeleteToast(false)}
        />
      )}
    </div>
  );
}
