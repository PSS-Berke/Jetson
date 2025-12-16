"use client";

import { useState, useEffect, useMemo } from "react";
import { getJobsInTimeRange } from "@/lib/productionUtils";
import {
  calculateBillingRatePerM,
  formatCurrency,
  formatPercentage,
  getProfitTextColor,
} from "@/lib/jobCostUtils";
import { getJobsV2, updateJob, type JobV2 } from "@/lib/api";
import Toast from "./Toast";
import Pagination from "./Pagination";
import type { ParsedJob } from "@/hooks/useJobs";

type SortField =
  | "job_number"
  | "job_name"
  | "client_name"
  | "quantity"
  | "billing_rate_per_m"
  | "current_cost_per_m"
  | "profit_percentage";
type SortDirection = "asc" | "desc";

interface InlineJobCostEntryProps {
  jobs: ParsedJob[];
  startDate: number;
  endDate: number;
  facilitiesId?: number;
  onSuccess?: () => void;
}

interface JobCostEntryData {
  job_id: number;
  job_number: string;
  job_name: string;
  client_name: string;
  quantity: number;
  billing_rate_per_m: number;
  current_cost_per_m: number;
  add_to_cost: string;
  set_total_cost: string;
  notes: string;
}

export default function InlineJobCostEntry({
  jobs,
  startDate,
  endDate,
  facilitiesId,
  onSuccess,
}: InlineJobCostEntryProps) {
  const [jobEntries, setJobEntries] = useState<JobCostEntryData[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>("job_number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Initialize job entries when date range changes OR when refreshTrigger changes
  useEffect(() => {
    console.log("[InlineJobCostEntry] Effect triggered:", {
      jobsLength: jobs.length,
      startDate,
      endDate,
      facilitiesId,
    });

    if (jobs.length > 0) {
      const loadEntriesWithCosts = async () => {
        const relevantJobs = getJobsInTimeRange(jobs, startDate, endDate);

        console.log(
          "[InlineJobCostEntry] Relevant jobs in time range:",
          relevantJobs.length,
        );

        // Fetch jobs from v2 API to get actual_cost_per_m
        try {
          // Fetch all jobs for the facility to get their actual_cost_per_m values
          // Handle pagination to get all jobs
          const allJobs: JobV2[] = [];
          let currentPage = 1;
          let hasMore = true;

          while (hasMore) {
            const jobsResponse = await getJobsV2({
              facilities_id: facilitiesId || 0,
              page: currentPage,
              per_page: 1000,
            });

            allJobs.push(...jobsResponse.items);

            // Check if there are more pages
            if (jobsResponse.nextPage !== null) {
              currentPage = jobsResponse.nextPage;
            } else {
              hasMore = false;
            }
          }

          console.log(
            "[InlineJobCostEntry] Fetched jobs:",
            allJobs.length,
          );

          // Create map of job_id to current cost from the jobs
          const costsMap = new Map<number, number>();
          allJobs.forEach((job) => {
            if (job.actual_cost_per_m !== null && job.actual_cost_per_m !== undefined) {
              costsMap.set(job.id, job.actual_cost_per_m);
            }
          });

          const entries: JobCostEntryData[] = relevantJobs.map((job) => {
            const billingRate = calculateBillingRatePerM(job);
            // Get cost from map, or from the job itself if available, or default to 0
            const currentCost = costsMap.get(job.id) ?? job.actual_cost_per_m ?? 0;
            const clientName = job.client?.name || "Unknown";
            const fullClientName = job.sub_client
              ? `${clientName} / ${job.sub_client}`
              : clientName;

            return {
              job_id: job.id,
              job_number: job.job_number,
              job_name: job.job_name,
              client_name: fullClientName,
              quantity: job.quantity,
              billing_rate_per_m: billingRate,
              current_cost_per_m: currentCost,
              add_to_cost: "",
              set_total_cost: "",
              notes: "",
            };
          });

          console.log(
            "[InlineJobCostEntry] Setting job entries:",
            entries.length,
          );
          setJobEntries(entries);
          // Reset to page 1 when entries change
          setCurrentPage(1);
        } catch (error) {
          console.error(
            "[InlineJobCostEntry] Error loading cost entries:",
            error,
          );
          // Set entries with zero costs if fetch fails
          const entries: JobCostEntryData[] = relevantJobs.map((job) => {
            const billingRate = calculateBillingRatePerM(job);

            return {
              job_id: job.id,
              job_number: job.job_number,
              job_name: job.job_name,
              client_name: job.client?.name || "Unknown",
              quantity: job.quantity,
              billing_rate_per_m: billingRate,
              current_cost_per_m: 0,
              add_to_cost: "",
              set_total_cost: "",
              notes: "",
            };
          });
          console.log(
            "[InlineJobCostEntry] Setting job entries (after error):",
            entries.length,
          );
          setJobEntries(entries);
          // Reset to page 1 when entries change
          setCurrentPage(1);
        }
      };

      loadEntriesWithCosts();
    } else {
      console.log("[InlineJobCostEntry] No jobs available");
    }
  }, [jobs, startDate, endDate, facilitiesId, refreshTrigger]);

  // Clear inputs when exiting batch mode
  useEffect(() => {
    if (!isBatchMode) {
      const newEntries = jobEntries.map((entry) => ({
        ...entry,
        add_to_cost: "",
        set_total_cost: "",
        notes: "",
      }));
      setJobEntries(newEntries);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBatchMode]);

  // Handle input changes
  const handleAddToCostChange = (jobId: number, value: string) => {
    const validChars = value.replace(/[^\d.]/g, "");
    const parts = validChars.split(".");
    if (parts.length > 2) return;

    setJobEntries((prev) =>
      prev.map((entry) =>
        entry.job_id === jobId
          ? { ...entry, add_to_cost: validChars, set_total_cost: "" }
          : entry,
      ),
    );
  };

  const handleSetTotalCostChange = (jobId: number, value: string) => {
    const validChars = value.replace(/[^\d.]/g, "");
    const parts = validChars.split(".");
    if (parts.length > 2) return;

    setJobEntries((prev) =>
      prev.map((entry) =>
        entry.job_id === jobId
          ? { ...entry, set_total_cost: validChars, add_to_cost: "" }
          : entry,
      ),
    );
  };

  const handleNotesChange = (jobId: number, value: string) => {
    setJobEntries((prev) =>
      prev.map((entry) =>
        entry.job_id === jobId ? { ...entry, notes: value } : entry,
      ),
    );
  };

  // Calculate the new cost for display
  const getNewCost = (entry: JobCostEntryData): number => {
    if (entry.add_to_cost) {
      return entry.current_cost_per_m + parseFloat(entry.add_to_cost);
    } else if (entry.set_total_cost) {
      return parseFloat(entry.set_total_cost);
    }
    return entry.current_cost_per_m;
  };

  // Calculate profit metrics for preview
  const getProfitPreview = (entry: JobCostEntryData) => {
    const newCost = getNewCost(entry);
    const profit = entry.billing_rate_per_m - newCost;
    const profitPercentage =
      entry.billing_rate_per_m > 0
        ? (profit / entry.billing_rate_per_m) * 100
        : 0;
    return { profit, profitPercentage };
  };

  // Handle batch save
  const handleBatchSave = async () => {
    setSubmitting(true);
    setErrorMessage("");

    try {
      const entriesToSubmit = jobEntries
        .filter(
          (entry) =>
            entry.add_to_cost.trim() !== "" ||
            entry.set_total_cost.trim() !== "",
        )
        .map((entry) => {
          let final_cost_per_m: number;

          if (entry.add_to_cost.trim() !== "") {
            const addAmount = parseFloat(entry.add_to_cost);
            if (isNaN(addAmount) || addAmount < 0) {
              throw new Error(`Invalid add amount for job ${entry.job_number}`);
            }
            final_cost_per_m = entry.current_cost_per_m + addAmount;
          } else {
            final_cost_per_m = parseFloat(entry.set_total_cost);
            if (isNaN(final_cost_per_m) || final_cost_per_m < 0) {
              throw new Error(`Invalid cost for job ${entry.job_number}`);
            }
          }

          return {
            job_id: entry.job_id,
            final_cost_per_m,
            notes: entry.notes,
          };
        });

      console.log("[InlineJobCostEntry] Entries to submit:", entriesToSubmit);

      if (entriesToSubmit.length === 0) {
        setErrorMessage("Please enter at least one cost value");
        setShowErrorToast(true);
        setSubmitting(false);
        return;
      }

      // Update jobs directly with new actual_cost_per_m values
      const updatePromises = entriesToSubmit.map((entry) =>
        updateJob(entry.job_id, {
          actual_cost_per_m: entry.final_cost_per_m,
        }),
      );

      const updatedJobs = await Promise.all(updatePromises);
      console.log(
        "[InlineJobCostEntry] Successfully updated",
        updatedJobs.length,
        "jobs",
      );

      // Trigger refresh to fetch updated costs
      setRefreshTrigger((prev) => prev + 1);

      // Show success
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        if (onSuccess) onSuccess();
        // Exit batch mode
        setIsBatchMode(false);
      }, 2000);
    } catch (error) {
      console.error("[InlineJobCostEntry] Error submitting:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save cost entries",
      );
      setShowErrorToast(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchCancel = () => {
    setIsBatchMode(false);
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field and reset to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort entries
  const sortedEntries = useMemo(() => {
    return [...jobEntries].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "job_number":
          aValue = a.job_number;
          bValue = b.job_number;
          break;
        case "job_name":
          aValue = a.job_name.toLowerCase();
          bValue = b.job_name.toLowerCase();
          break;
        case "client_name":
          aValue = a.client_name.toLowerCase();
          bValue = b.client_name.toLowerCase();
          break;
        case "quantity":
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case "billing_rate_per_m":
          aValue = a.billing_rate_per_m;
          bValue = b.billing_rate_per_m;
          break;
        case "current_cost_per_m":
          aValue = a.current_cost_per_m;
          bValue = b.current_cost_per_m;
          break;
        case "profit_percentage":
          // Calculate profit percentage for sorting
          aValue =
            a.billing_rate_per_m > 0 && a.current_cost_per_m > 0
              ? ((a.billing_rate_per_m - a.current_cost_per_m) /
                  a.billing_rate_per_m) *
                100
              : 0;
          bValue =
            b.billing_rate_per_m > 0 && b.current_cost_per_m > 0
              ? ((b.billing_rate_per_m - b.current_cost_per_m) /
                  b.billing_rate_per_m) *
                100
              : 0;
          break;
        default:
          aValue = a.job_number;
          bValue = b.job_number;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [jobEntries, sortField, sortDirection]);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Calculate paginated entries from sorted entries
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEntries = sortedEntries.slice(startIndex, endIndex);

  console.log(
    "[InlineJobCostEntry] Rendering, jobEntries.length:",
    jobEntries.length,
  );

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return (
      <span className="text-blue-600 ml-1">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (jobEntries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No jobs found in the selected time period.</p>
          <p className="text-sm">
            Adjust your date range to see jobs available for cost tracking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div>
          {isBatchMode ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-600">
                Batch Entry Mode
              </span>
              <span className="text-xs text-gray-500">
                Add to current or set new total for each job
              </span>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Job Cost Entry
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Enter actual costs per thousand for jobs in this period
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isBatchMode ? (
            <>
              <button
                onClick={handleBatchCancel}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchSave}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsBatchMode(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Batch Edit
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                onClick={() => handleSort("job_number")}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Job #
                  <SortIcon field="job_number" />
                </div>
              </th>
              <th
                onClick={() => handleSort("job_name")}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Job Name
                  <SortIcon field="job_name" />
                </div>
              </th>
              <th
                onClick={() => handleSort("client_name")}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Client
                  <SortIcon field="client_name" />
                </div>
              </th>
              <th
                onClick={() => handleSort("quantity")}
                className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-1">
                  Qty
                  <SortIcon field="quantity" />
                </div>
              </th>
              <th
                onClick={() => handleSort("billing_rate_per_m")}
                className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-1">
                  Billing Rate (per/M)
                  <SortIcon field="billing_rate_per_m" />
                </div>
              </th>
              <th
                onClick={() => handleSort("current_cost_per_m")}
                className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-1">
                  {isBatchMode
                    ? "Current Cost (per/M)"
                    : "Current Cost (per/M)"}
                  <SortIcon field="current_cost_per_m" />
                </div>
              </th>
              {isBatchMode ? (
                <>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Add to Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Set Total Cost
                  </th>
                  <th
                    onClick={() => handleSort("profit_percentage")}
                    className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[130px] cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Profit %
                      <SortIcon field="profit_percentage" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Notes
                  </th>
                </>
              ) : (
                <th
                  onClick={() => handleSort("profit_percentage")}
                  className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[130px] cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-end gap-1">
                    Profit %
                    <SortIcon field="profit_percentage" />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedEntries.map((entry, index) => {
              // Calculate the actual index in the full jobEntries array
              const actualIndex = startIndex + index;
              const hasInput = entry.add_to_cost || entry.set_total_cost;
              const { profitPercentage } = getProfitPreview(entry);
              const currentProfitPercentage =
                entry.billing_rate_per_m > 0 && entry.current_cost_per_m > 0
                  ? ((entry.billing_rate_per_m - entry.current_cost_per_m) /
                      entry.billing_rate_per_m) *
                    100
                  : 0;

              // Determine which profit % to display in batch mode
              const displayProfitPercentage = hasInput
                ? profitPercentage
                : currentProfitPercentage;
              const showProfit = hasInput || entry.current_cost_per_m > 0;

              return (
                <tr key={entry.job_id} className="hover:bg-gray-50">
                  {/* Job # */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.job_number}
                  </td>

                  {/* Job Name */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.job_name}
                  </td>

                  {/* Client */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {entry.client_name}
                  </td>

                  {/* Quantity */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {entry.quantity.toLocaleString()}
                  </td>

                  {/* Billing Rate */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(entry.billing_rate_per_m)}
                  </td>

                  {/* Current Cost */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700 text-right">
                    {entry.current_cost_per_m > 0
                      ? formatCurrency(entry.current_cost_per_m)
                      : "—"}
                  </td>

                  {isBatchMode ? (
                    <>
                      {/* Add to Cost */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.add_to_cost}
                          onChange={(e) =>
                            handleAddToCostChange(entry.job_id, e.target.value)
                          }
                          placeholder="Add..."
                          className="w-24 px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>

                      {/* Set Total Cost */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.set_total_cost}
                          onChange={(e) =>
                            handleSetTotalCostChange(
                              entry.job_id,
                              e.target.value,
                            )
                          }
                          placeholder="Set..."
                          className="w-24 px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>

                      {/* Profit Preview */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                        <span
                          className={
                            showProfit
                              ? getProfitTextColor(displayProfitPercentage)
                              : "text-gray-400"
                          }
                        >
                          {showProfit
                            ? formatPercentage(displayProfitPercentage)
                            : "—"}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.notes}
                          onChange={(e) =>
                            handleNotesChange(entry.job_id, e.target.value)
                          }
                          placeholder="Optional notes"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>
                    </>
                  ) : (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                      <span
                        className={
                          entry.current_cost_per_m > 0
                            ? getProfitTextColor(currentProfitPercentage)
                            : "text-gray-400"
                        }
                      >
                        {entry.current_cost_per_m > 0
                          ? formatPercentage(currentProfitPercentage)
                          : "—"}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {jobEntries.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Pagination
            currentPage={currentPage}
            totalItems={jobEntries.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message="Cost entries saved successfully!"
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <Toast
          message={errorMessage || "Failed to save cost entries"}
          type="error"
          onClose={() => setShowErrorToast(false)}
        />
      )}
    </div>
  );
}
