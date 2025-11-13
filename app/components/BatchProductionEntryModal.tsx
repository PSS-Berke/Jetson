"use client";

import { useState, useEffect, FormEvent } from "react";
import { batchCreateProductionEntries, getProductionEntries } from "@/lib/api";
import { getJobsInTimeRange } from "@/lib/productionUtils";
import Toast from "./Toast";
import type { ParsedJob } from "@/hooks/useJobs";
import type { ProductionEntry } from "@/types";

interface BatchProductionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  jobs: ParsedJob[];
  startDate: number;
  endDate: number;
  facilitiesId?: number;
  granularity: "day" | "week" | "month";
}

interface JobEntryData {
  job_id: number;
  job_number: number;
  job_name: string;
  client_name: string;
  projected_quantity: number;
  current_actual: number; // Existing actual quantity from database
  add_amount: string; // Amount to add to current actual
  actual_quantity: string; // Total actual quantity (can be set directly)
  notes: string;
}

export default function BatchProductionEntryModal({
  isOpen,
  onClose,
  onSuccess,
  jobs,
  startDate,
  endDate,
  facilitiesId,
  granularity,
}: BatchProductionEntryModalProps) {
  const [jobEntries, setJobEntries] = useState<JobEntryData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Initialize job entries when modal opens or date range changes
  useEffect(() => {
    if (isOpen && jobs.length > 0) {
      const loadEntriesWithActuals = async () => {
        const relevantJobs = getJobsInTimeRange(jobs, startDate, endDate);

        // Fetch existing production entries for this period
        const existingEntries = await getProductionEntries(
          facilitiesId,
          startDate,
          endDate,
        );

        // Create a map of job_id to current actual quantity
        const actualsMap = new Map<number, number>();
        existingEntries.forEach((entry) => {
          const currentActual = actualsMap.get(entry.job) || 0;
          actualsMap.set(entry.job, currentActual + entry.actual_quantity);
        });

        const entries: JobEntryData[] = relevantJobs.map((job) => {
          // Calculate projected quantity for this period
          const totalDuration = job.due_date - job.start_date;
          const periodStart = Math.max(job.start_date, startDate);
          const periodEnd = Math.min(job.due_date, endDate);
          const periodDuration = periodEnd - periodStart;

          const projected_quantity =
            totalDuration > 0
              ? Math.round((job.quantity * periodDuration) / totalDuration)
              : job.quantity;

          const current_actual = actualsMap.get(job.id) || 0;

          return {
            job_id: job.id,
            job_number: job.job_number,
            job_name: job.job_name,
            client_name: job.client?.name || "Unknown",
            projected_quantity,
            current_actual,
            add_amount: "",
            actual_quantity: "",
            notes: "",
          };
        });

        setJobEntries(entries);
      };

      loadEntriesWithActuals();
    }
  }, [isOpen, jobs, startDate, endDate, facilitiesId]);

  // Handle input changes
  const handleAddAmountChange = (index: number, value: string) => {
    // Remove any non-digit characters (including commas)
    const digitsOnly = value.replace(/\D/g, "");

    const newEntries = [...jobEntries];
    newEntries[index].add_amount = digitsOnly;
    // Clear actual_quantity when using add_amount
    newEntries[index].actual_quantity = "";
    setJobEntries(newEntries);
  };

  // Removed - handleActualQuantityChange is not used
  // const handleActualQuantityChange = (index: number, value: string) => {
  //   const digitsOnly = value.replace(/\D/g, '');
  //   const newEntries = [...jobEntries];
  //   newEntries[index].actual_quantity = digitsOnly;
  //   newEntries[index].add_amount = '';
  //   setJobEntries(newEntries);
  // };

  const handleNotesChange = (index: number, value: string) => {
    const newEntries = [...jobEntries];
    newEntries[index].notes = value;
    setJobEntries(newEntries);
  };

  // Calculate the new total for display
  const getNewTotal = (entry: JobEntryData): number => {
    if (entry.add_amount) {
      return entry.current_actual + parseInt(entry.add_amount);
    } else if (entry.actual_quantity) {
      return parseInt(entry.actual_quantity);
    }
    return entry.current_actual;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      // Filter entries with either add_amount or actual_quantity entered
      const entriesToSubmit = jobEntries
        .filter(
          (entry) =>
            entry.add_amount.trim() !== "" ||
            entry.actual_quantity.trim() !== "",
        )
        .map((entry) => {
          // Calculate the final actual quantity
          let final_actual_quantity: number;

          if (entry.add_amount.trim() !== "") {
            // Add mode: add to current actual
            const addAmount = parseInt(entry.add_amount);
            if (isNaN(addAmount) || addAmount < 0) {
              throw new Error(`Invalid add amount for job ${entry.job_number}`);
            }
            final_actual_quantity = entry.current_actual + addAmount;
          } else {
            // Set mode: use the actual_quantity directly
            final_actual_quantity = parseInt(entry.actual_quantity);
            if (isNaN(final_actual_quantity) || final_actual_quantity < 0) {
              throw new Error(`Invalid quantity for job ${entry.job_number}`);
            }
          }

          const productionEntry: Omit<
            ProductionEntry,
            "id" | "created_at" | "updated_at"
          > = {
            job: entry.job_id, // Xano uses 'job' field name
            date: granularity === "week" ? startDate : Date.now(), // Use start of week or current date
            actual_quantity: final_actual_quantity,
            notes: entry.notes || undefined,
            facilities_id: facilitiesId,
          };

          return productionEntry;
        });

      console.log(
        "[BatchProductionEntryModal] Entries to submit:",
        entriesToSubmit,
      );

      if (entriesToSubmit.length === 0) {
        setErrorMessage("Please enter at least one production quantity");
        setShowErrorToast(true);
        setSubmitting(false);
        return;
      }

      // Submit batch entries
      console.log(
        "[BatchProductionEntryModal] Calling batchCreateProductionEntries with",
        entriesToSubmit.length,
        "entries",
      );
      const createdEntries =
        await batchCreateProductionEntries(entriesToSubmit);
      console.log(
        "[BatchProductionEntryModal] Successfully created",
        createdEntries.length,
        "entries:",
        createdEntries,
      );

      // Show success and trigger callbacks
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (error) {
      console.error("[BatchProductionEntryModal] Error submitting:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save production entries",
      );
      setShowErrorToast(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!submitting) {
      onClose();
      // Reset state after animation
      setTimeout(() => {
        setJobEntries([]);
        setErrorMessage("");
      }, 300);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800">
            Batch Production Entry
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Enter actual production quantities for jobs in this {granularity}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            {jobEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No active jobs found in this time period
              </div>
            ) : (
              <div className="space-y-4">
                {/* Table Header */}
                <div className="hidden md:grid md:grid-cols-[auto_1fr_1fr_100px_100px_120px_120px_1fr] gap-3 pb-2 border-b border-gray-200 font-semibold text-sm text-gray-700">
                  <div>Job #</div>
                  <div>Job Name</div>
                  <div>Client</div>
                  <div className="text-right">Projected</div>
                  <div className="text-right">Current</div>
                  <div>Add Amount</div>
                  <div>New Total</div>
                  <div>Notes</div>
                </div>

                {/* Job Entries */}
                {jobEntries.map((entry, index) => {
                  const newTotal = getNewTotal(entry);
                  const hasInput = entry.add_amount || entry.actual_quantity;

                  return (
                    <div
                      key={entry.job_id}
                      className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_100px_100px_120px_120px_1fr] gap-3 items-center p-4 md:p-0 bg-gray-50 md:bg-transparent rounded-lg md:rounded-none"
                    >
                      {/* Job # */}
                      <div>
                        <span className="md:hidden font-semibold text-sm text-gray-600">
                          Job #:{" "}
                        </span>
                        <span className="text-sm">{entry.job_number}</span>
                      </div>

                      {/* Job Name */}
                      <div>
                        <span className="md:hidden font-semibold text-sm text-gray-600">
                          Job:{" "}
                        </span>
                        <span className="text-sm">{entry.job_name}</span>
                      </div>

                      {/* Client */}
                      <div>
                        <span className="md:hidden font-semibold text-sm text-gray-600">
                          Client:{" "}
                        </span>
                        <span className="text-sm text-gray-600">
                          {entry.client_name}
                        </span>
                      </div>

                      {/* Projected */}
                      <div className="md:text-right">
                        <span className="md:hidden font-semibold text-sm text-gray-600">
                          Projected:{" "}
                        </span>
                        <span className="text-sm text-gray-500">
                          {entry.projected_quantity.toLocaleString()}
                        </span>
                      </div>

                      {/* Current Actual (read-only) */}
                      <div className="md:text-right">
                        <span className="md:hidden font-semibold text-sm text-gray-600">
                          Current Actual:{" "}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {entry.current_actual.toLocaleString()}
                        </span>
                      </div>

                      {/* Add Amount */}
                      <div>
                        <label className="md:hidden font-semibold text-sm text-gray-600 block mb-1">
                          Add Amount
                        </label>
                        <input
                          type="text"
                          value={
                            entry.add_amount
                              ? parseInt(entry.add_amount).toLocaleString()
                              : ""
                          }
                          onChange={(e) =>
                            handleAddAmountChange(index, e.target.value)
                          }
                          placeholder="Add..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {/* New Total (calculated) */}
                      <div className="md:text-right">
                        <span className="md:hidden font-semibold text-sm text-gray-600">
                          New Total:{" "}
                        </span>
                        <span
                          className={`text-sm font-semibold ${hasInput ? "text-blue-600" : "text-gray-400"}`}
                        >
                          {newTotal.toLocaleString()}
                        </span>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="md:hidden font-semibold text-sm text-gray-600 block mb-1">
                          Notes (Optional)
                        </label>
                        <input
                          type="text"
                          value={entry.notes}
                          onChange={(e) =>
                            handleNotesChange(index, e.target.value)
                          }
                          placeholder="Optional notes"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || jobEntries.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : "Save Production Entries"}
            </button>
          </div>
        </form>
      </div>

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message="Production entries saved successfully!"
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <Toast
          message={errorMessage || "Failed to save production entries"}
          type="error"
          onClose={() => setShowErrorToast(false)}
        />
      )}
    </div>
  );
}
