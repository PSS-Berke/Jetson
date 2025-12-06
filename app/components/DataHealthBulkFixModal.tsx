"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getJobsByHealthIssue,
  bulkUpdateJobsWithProgress,
  type Job,
  type DataHealthIssueType,
} from "@/lib/api";
import {
  X,
  AlertCircle,
  CheckCircle2,
  Calendar,
  CalendarX,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface DataHealthBulkFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  issueType: DataHealthIssueType;
  facilitiesId: number | null;
}

interface EditedJob {
  start_date?: number | null;
  due_date?: number | null;
}

const ISSUE_CONFIG: Record<
  DataHealthIssueType,
  {
    title: string;
    description: string;
    icon: typeof CalendarX;
    primaryField: "start_date" | "due_date";
  }
> = {
  missing_due_dates: {
    title: "Fix Missing Due Dates",
    description: "The following jobs are missing due dates. Add due dates to fix these issues.",
    icon: CalendarX,
    primaryField: "due_date",
  },
  missing_start_date: {
    title: "Fix Missing Start Dates",
    description: "The following jobs are missing start dates. Add start dates to fix these issues.",
    icon: Calendar,
    primaryField: "start_date",
  },
  start_is_after_due: {
    title: "Fix Start After Due Date",
    description: "The following jobs have start dates that are after their due dates. Adjust the dates to fix these issues.",
    icon: AlertCircle,
    primaryField: "start_date",
  },
};

export default function DataHealthBulkFixModal({
  isOpen,
  onClose,
  onSuccess,
  issueType,
  facilitiesId,
}: DataHealthBulkFixModalProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editedJobs, setEditedJobs] = useState<Map<number, EditedJob>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{
    success: number;
    failures: { jobId: number; error: string }[];
  } | null>(null);
  const [bulkDate, setBulkDate] = useState<string>("");

  const config = ISSUE_CONFIG[issueType];
  const IconComponent = config.icon;

  // Fetch jobs when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchJobs = async () => {
      setIsLoading(true);
      setError(null);
      setSaveResult(null);
      setEditedJobs(new Map());
      setBulkDate("");

      try {
        const fetchedJobs = await getJobsByHealthIssue(
          issueType,
          facilitiesId
        );
        setJobs(fetchedJobs);
      } catch (err) {
        console.error("[DataHealthBulkFixModal] Error fetching jobs:", err);
        setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, [isOpen, issueType, facilitiesId]);

  // Get the current value for a job field (edited or original)
  const getJobValue = (job: Job, field: "start_date" | "due_date"): number | null | undefined => {
    const edited = editedJobs.get(job.id);
    if (edited && field in edited) {
      return edited[field];
    }
    return job[field];
  };

  // Format date for display in input
  const formatDateForInput = (timestamp: number | null | undefined): string => {
    if (!timestamp) return "";
    return format(new Date(timestamp), "yyyy-MM-dd");
  };

  // Parse date from input to timestamp
  const parseDateFromInput = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.getTime();
  };

  // Handle individual job date change
  const handleDateChange = (
    jobId: number,
    field: "start_date" | "due_date",
    value: string
  ) => {
    const timestamp = parseDateFromInput(value);
    setEditedJobs((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(jobId) || {};
      newMap.set(jobId, { ...existing, [field]: timestamp });
      return newMap;
    });
  };

  // Apply bulk date to all jobs
  const handleApplyBulkDate = () => {
    if (!bulkDate) return;
    const timestamp = parseDateFromInput(bulkDate);

    setEditedJobs((prev) => {
      const newMap = new Map(prev);
      jobs.forEach((job) => {
        const existing = newMap.get(job.id) || {};
        newMap.set(job.id, { ...existing, [config.primaryField]: timestamp });
      });
      return newMap;
    });
  };

  // Check if a job row is valid (no date conflicts)
  const isJobValid = (job: Job): boolean => {
    const startDate = getJobValue(job, "start_date");
    const dueDate = getJobValue(job, "due_date");

    // For missing dates, check if they're now filled
    if (issueType === "missing_due_dates") {
      return dueDate !== null && dueDate !== undefined;
    }
    if (issueType === "missing_start_date") {
      return startDate !== null && startDate !== undefined;
    }
    // For start_is_after_due, check if start <= due
    if (issueType === "start_is_after_due") {
      if (!startDate || !dueDate) return false;
      return startDate <= dueDate;
    }
    return true;
  };

  // Count of jobs that have been edited and are now valid
  const validEditedCount = useMemo(() => {
    return jobs.filter((job) => editedJobs.has(job.id) && isJobValid(job)).length;
  }, [jobs, editedJobs, issueType]);

  // Count of jobs that are still invalid
  const invalidCount = useMemo(() => {
    return jobs.filter((job) => !isJobValid(job)).length;
  }, [jobs, editedJobs, issueType]);

  // Handle save
  const handleSave = async () => {
    // Only save jobs that have been edited
    const updates = Array.from(editedJobs.entries())
      .filter(([jobId]) => {
        const job = jobs.find((j) => j.id === jobId);
        return job && isJobValid(job);
      })
      .map(([jobId, edits]) => ({
        id: jobId,
        data: edits as Partial<Job>,
      }));

    if (updates.length === 0) {
      setError("No valid changes to save");
      return;
    }

    setIsSaving(true);
    setSaveProgress({ current: 0, total: updates.length });
    setError(null);

    try {
      const result = await bulkUpdateJobsWithProgress(updates, (current, total) => {
        setSaveProgress({ current, total });
      });

      setSaveResult({
        success: result.success.length,
        failures: result.failures,
      });

      if (result.failures.length === 0) {
        // All successful - refresh and close after a short delay
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error("[DataHealthBulkFixModal] Error saving:", err);
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Get facility name
  const getFacilityName = (facilitiesId: number | undefined): string => {
    switch (facilitiesId) {
      case 1:
        return "Bolingbrook";
      case 2:
        return "Lemont";
      case 3:
        return "Shakopee";
      default:
        return "Unknown";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <IconComponent className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {config.title}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {config.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-3 text-gray-600">Loading jobs...</span>
            </div>
          ) : error && !saveResult ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          ) : saveResult ? (
            <div className="space-y-4">
              {saveResult.success > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-green-700">
                    Successfully updated {saveResult.success} job{saveResult.success !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {saveResult.failures.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                    <AlertCircle className="w-5 h-5" />
                    Failed to update {saveResult.failures.length} job{saveResult.failures.length !== 1 ? "s" : ""}
                  </div>
                  <ul className="text-sm text-red-600 space-y-1 ml-7">
                    {saveResult.failures.map((f) => (
                      <li key={f.jobId}>
                        Job ID {f.jobId}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>No jobs found with this issue.</p>
            </div>
          ) : (
            <>
              {/* Quick Actions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-blue-800">
                    Quick Action: Set all {config.primaryField === "due_date" ? "due dates" : "start dates"} to
                  </span>
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleApplyBulkDate}
                    disabled={!bulkDate}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply to All
                  </button>
                </div>
              </div>

              {/* Jobs Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Job #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Facility
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Start Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {jobs.map((job) => {
                      const isValid = isJobValid(job);
                      const isEdited = editedJobs.has(job.id);

                      return (
                        <tr
                          key={job.id}
                          className={`${
                            isEdited && isValid
                              ? "bg-green-50"
                              : !isValid
                              ? "bg-red-50"
                              : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {job.job_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {job.client || job.sub_client || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {getFacilityName(job.facilities_id)}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={formatDateForInput(getJobValue(job, "start_date"))}
                              onChange={(e) =>
                                handleDateChange(job.id, "start_date", e.target.value)
                              }
                              className={`px-2 py-1 border rounded text-sm w-full max-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                issueType === "missing_start_date" && !getJobValue(job, "start_date")
                                  ? "border-red-300 bg-red-50"
                                  : issueType === "start_is_after_due"
                                  ? "border-orange-300"
                                  : "border-gray-300"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={formatDateForInput(getJobValue(job, "due_date"))}
                              onChange={(e) =>
                                handleDateChange(job.id, "due_date", e.target.value)
                              }
                              className={`px-2 py-1 border rounded text-sm w-full max-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                issueType === "missing_due_dates" && !getJobValue(job, "due_date")
                                  ? "border-red-300 bg-red-50"
                                  : issueType === "start_is_after_due"
                                  ? "border-orange-300"
                                  : "border-gray-300"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isValid ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500 mx-auto" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Total: <strong>{jobs.length}</strong> jobs
                </span>
                {validEditedCount > 0 && (
                  <span className="text-green-600">
                    <CheckCircle2 className="w-4 h-4 inline mr-1" />
                    <strong>{validEditedCount}</strong> ready to save
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="text-red-600">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    <strong>{invalidCount}</strong> still need fixing
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div>
            {isSaving && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving {saveProgress.current} of {saveProgress.total}...
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saveResult ? "Close" : "Cancel"}
            </button>
            {!saveResult && jobs.length > 0 && (
              <button
                onClick={handleSave}
                disabled={isSaving || validEditedCount === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `Save ${validEditedCount} Change${validEditedCount !== 1 ? "s" : ""}`
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
