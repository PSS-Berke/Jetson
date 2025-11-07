'use client';

import { useState, useEffect, FormEvent } from 'react';
import { getJobsInTimeRange } from '@/lib/productionUtils';
import { calculateBillingRatePerM, formatCurrency, formatPercentage, getProfitTextColor } from '@/lib/jobCostUtils';
import { getJobCostEntries, batchCreateJobCostEntries, deleteJobCostEntry } from '@/lib/api';
import Toast from './Toast';
import type { ParsedJob } from '@/hooks/useJobs';
import type { JobCostEntry } from '@/lib/jobCostUtils';

interface BatchJobCostEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  jobs: ParsedJob[];
  startDate: number;
  endDate: number;
  facilitiesId?: number;
}

interface JobCostEntryData {
  job_id: number;
  job_number: number;
  job_name: string;
  client_name: string;
  quantity: number;
  billing_rate_per_m: number;
  current_cost_per_m: number; // Existing cost from database
  add_to_cost: string; // Amount to add to current cost
  set_total_cost: string; // Total cost (can be set directly)
  notes: string;
}

export default function BatchJobCostEntryModal({
  isOpen,
  onClose,
  onSuccess,
  jobs,
  startDate,
  endDate,
  facilitiesId,
}: BatchJobCostEntryModalProps) {
  const [jobEntries, setJobEntries] = useState<JobCostEntryData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize job entries when modal opens or date range changes OR when refreshTrigger changes
  useEffect(() => {
    if (isOpen && jobs.length > 0) {
      const loadEntriesWithCosts = async () => {
        const relevantJobs = getJobsInTimeRange(jobs, startDate, endDate);

        // Fetch existing cost entries for this period from API
        try {
          const existingEntries = await getJobCostEntries(facilitiesId, startDate, endDate);

          // Create map of job_id to current cost
          const costsMap = new Map<number, number>();
          existingEntries.forEach(entry => {
            costsMap.set(entry.job, entry.actual_cost_per_m);
          });

          const entries: JobCostEntryData[] = relevantJobs.map((job) => {
            const billingRate = calculateBillingRatePerM(job);
            const currentCost = costsMap.get(job.id) || 0;

            return {
              job_id: job.id,
              job_number: job.job_number,
              job_name: job.job_name,
              client_name: job.client?.name || 'Unknown',
              quantity: job.quantity,
              billing_rate_per_m: billingRate,
              current_cost_per_m: currentCost,
              add_to_cost: '',
              set_total_cost: '',
              notes: '',
            };
          });

          setJobEntries(entries);
        } catch (error) {
          console.error('[BatchJobCostEntryModal] Error loading cost entries:', error);
          // Set entries with zero costs if fetch fails
          const entries: JobCostEntryData[] = relevantJobs.map((job) => {
            const billingRate = calculateBillingRatePerM(job);

            return {
              job_id: job.id,
              job_number: job.job_number,
              job_name: job.job_name,
              client_name: job.client?.name || 'Unknown',
              quantity: job.quantity,
              billing_rate_per_m: billingRate,
              current_cost_per_m: 0,
              add_to_cost: '',
              set_total_cost: '',
              notes: '',
            };
          });
          setJobEntries(entries);
        }
      };

      loadEntriesWithCosts();
    }
  }, [isOpen, jobs, startDate, endDate, facilitiesId, refreshTrigger]);

  // Handle input changes
  const handleAddToCostChange = (index: number, value: string) => {
    // Allow digits and decimal point
    const validChars = value.replace(/[^\d.]/g, '');
    const parts = validChars.split('.');
    if (parts.length > 2) return;

    const newEntries = [...jobEntries];
    newEntries[index].add_to_cost = validChars;
    // Clear set_total_cost when using add_to_cost
    newEntries[index].set_total_cost = '';
    setJobEntries(newEntries);
  };

  const handleSetTotalCostChange = (index: number, value: string) => {
    // Allow digits and decimal point
    const validChars = value.replace(/[^\d.]/g, '');
    const parts = validChars.split('.');
    if (parts.length > 2) return;

    const newEntries = [...jobEntries];
    newEntries[index].set_total_cost = validChars;
    // Clear add_to_cost when using set_total_cost
    newEntries[index].add_to_cost = '';
    setJobEntries(newEntries);
  };

  const handleNotesChange = (index: number, value: string) => {
    const newEntries = [...jobEntries];
    newEntries[index].notes = value;
    setJobEntries(newEntries);
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
    const profitPercentage = entry.billing_rate_per_m > 0 ? (profit / entry.billing_rate_per_m) * 100 : 0;
    return { profit, profitPercentage };
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      // Filter entries with either add_to_cost or set_total_cost entered
      const entriesToSubmit = jobEntries
        .filter((entry) => entry.add_to_cost.trim() !== '' || entry.set_total_cost.trim() !== '')
        .map((entry) => {
          // Calculate the final cost per thousand
          let final_cost_per_m: number;

          if (entry.add_to_cost.trim() !== '') {
            // Add mode: add to current cost
            const addAmount = parseFloat(entry.add_to_cost);
            if (isNaN(addAmount) || addAmount < 0) {
              throw new Error(`Invalid add amount for job ${entry.job_number}`);
            }
            final_cost_per_m = entry.current_cost_per_m + addAmount;
          } else {
            // Set mode: use the set_total_cost directly
            final_cost_per_m = parseFloat(entry.set_total_cost);
            if (isNaN(final_cost_per_m) || final_cost_per_m < 0) {
              throw new Error(`Invalid cost for job ${entry.job_number}`);
            }
          }

          const costEntry: Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'> = {
            job: entry.job_id,
            date: Date.now(),
            actual_cost_per_m: final_cost_per_m,
            notes: entry.notes || undefined,
            facilities_id: facilitiesId,
          };

          return costEntry;
        });

      console.log('[BatchJobCostEntryModal] Entries to submit:', entriesToSubmit);

      if (entriesToSubmit.length === 0) {
        setErrorMessage('Please enter at least one cost value');
        setShowErrorToast(true);
        setSubmitting(false);
        return;
      }

      // Delete old entries for these jobs first
      const jobIds = entriesToSubmit.map(e => e.job);
      const existingEntries = await getJobCostEntries(facilitiesId, startDate, endDate);
      const entriesToDelete = existingEntries.filter(e => jobIds.includes(e.job));

      if (entriesToDelete.length > 0) {
        await Promise.all(entriesToDelete.map(e => deleteJobCostEntry(e.id)));
      }

      // Create new entries
      const createdEntries = await batchCreateJobCostEntries(entriesToSubmit);
      console.log('[BatchJobCostEntryModal] Successfully created', createdEntries.length, 'entries');

      // Trigger refresh to fetch updated costs
      setRefreshTrigger(prev => prev + 1);

      // Show success and trigger callbacks
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (error) {
      console.error('[BatchJobCostEntryModal] Error submitting:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save cost entries');
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
        setErrorMessage('');
      }, 300);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={handleClose}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800">
            Batch Job Cost Entry
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Enter actual costs per thousand for jobs in this period
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
                <div className="hidden lg:grid lg:grid-cols-[auto_1fr_1fr_80px_110px_110px_110px_110px_130px_1fr] gap-3 pb-2 border-b border-gray-200 font-semibold text-xs text-gray-700">
                  <div>Job #</div>
                  <div>Job Name</div>
                  <div>Client</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Billing Rate (per/M)</div>
                  <div className="text-right">Current Cost (per/M)</div>
                  <div>Add to Cost</div>
                  <div>Set Total Cost</div>
                  <div className="text-right">Profit %</div>
                  <div>Notes</div>
                </div>

                {/* Job Entries */}
                {jobEntries.map((entry, index) => {
                  // const newCost = getNewCost(entry);
                  const hasInput = entry.add_to_cost || entry.set_total_cost;
                  const { profitPercentage } = getProfitPreview(entry);

                  // Calculate current profit % for existing costs
                  const currentProfitPercentage = entry.current_cost_per_m > 0 && entry.billing_rate_per_m > 0
                    ? ((entry.billing_rate_per_m - entry.current_cost_per_m) / entry.billing_rate_per_m) * 100
                    : 0;

                  // Determine which profit % to display
                  const displayProfitPercentage = hasInput ? profitPercentage : currentProfitPercentage;
                  const showProfit = hasInput || entry.current_cost_per_m > 0;

                  return (
                    <div
                      key={entry.job_id}
                      className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr_80px_110px_110px_110px_110px_130px_1fr] gap-3 items-center p-4 lg:p-0 bg-gray-50 lg:bg-transparent rounded-lg lg:rounded-none border-b border-gray-100"
                    >
                      {/* Job # */}
                      <div>
                        <span className="lg:hidden font-semibold text-sm text-gray-600">Job #: </span>
                        <span className="text-sm font-medium">{entry.job_number}</span>
                      </div>

                      {/* Job Name */}
                      <div>
                        <span className="lg:hidden font-semibold text-sm text-gray-600">Job: </span>
                        <span className="text-sm">{entry.job_name}</span>
                      </div>

                      {/* Client */}
                      <div>
                        <span className="lg:hidden font-semibold text-sm text-gray-600">Client: </span>
                        <span className="text-sm text-gray-600">{entry.client_name}</span>
                      </div>

                      {/* Quantity */}
                      <div className="lg:text-right">
                        <span className="lg:hidden font-semibold text-sm text-gray-600">Quantity: </span>
                        <span className="text-sm text-gray-500">{entry.quantity.toLocaleString()}</span>
                      </div>

                      {/* Billing Rate */}
                      <div className="lg:text-right">
                        <span className="lg:hidden font-semibold text-sm text-gray-600">Billing Rate: </span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(entry.billing_rate_per_m)}</span>
                      </div>

                      {/* Current Cost (read-only) */}
                      <div className="lg:text-right">
                        <span className="lg:hidden font-semibold text-sm text-gray-600">Current Cost: </span>
                        <span className="text-sm font-medium text-gray-700">
                          {entry.current_cost_per_m > 0 ? formatCurrency(entry.current_cost_per_m) : '—'}
                        </span>
                      </div>

                      {/* Add to Cost */}
                      <div>
                        <label className="lg:hidden font-semibold text-sm text-gray-600 block mb-1">
                          Add to Cost
                        </label>
                        <input
                          type="text"
                          value={entry.add_to_cost}
                          onChange={(e) => handleAddToCostChange(index, e.target.value)}
                          placeholder="Add..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {/* Set Total Cost */}
                      <div>
                        <label className="lg:hidden font-semibold text-sm text-gray-600 block mb-1">
                          Set Total Cost
                        </label>
                        <input
                          type="text"
                          value={entry.set_total_cost}
                          onChange={(e) => handleSetTotalCostChange(index, e.target.value)}
                          placeholder="Set..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {/* Profit Preview */}
                      <div className="lg:text-right">
                        <span className="lg:hidden font-semibold text-sm text-gray-600">Profit %: </span>
                        <span className={`text-sm font-semibold ${showProfit ? getProfitTextColor(displayProfitPercentage) : 'text-gray-400'}`}>
                          {showProfit ? formatPercentage(displayProfitPercentage) : '—'}
                        </span>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="lg:hidden font-semibold text-sm text-gray-600 block mb-1">
                          Notes (Optional)
                        </label>
                        <input
                          type="text"
                          value={entry.notes}
                          onChange={(e) => handleNotesChange(index, e.target.value)}
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
              {submitting ? 'Saving...' : 'Save Cost Entries'}
            </button>
          </div>
        </form>
      </div>

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
          message={errorMessage || 'Failed to save cost entries'}
          type="error"
          onClose={() => setShowErrorToast(false)}
        />
      )}
    </div>
  );
}
