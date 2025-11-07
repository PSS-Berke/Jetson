'use client';

import { useState, useEffect } from 'react';
import { getJobsInTimeRange } from '@/lib/productionUtils';
import { calculateBillingRatePerM, formatCurrency, formatPercentage, getProfitTextColor } from '@/lib/jobCostUtils';
import { getJobCostEntries, batchCreateJobCostEntries, deleteJobCostEntry } from '@/lib/api';
import Toast from './Toast';
import type { ParsedJob } from '@/hooks/useJobs';
import type { JobCostEntry } from '@/lib/jobCostUtils';

interface InlineJobCostEntryProps {
  jobs: ParsedJob[];
  startDate: number;
  endDate: number;
  facilitiesId?: number;
  onSuccess?: () => void;
}

interface JobCostEntryData {
  job_id: number;
  job_number: number;
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
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize job entries when date range changes OR when refreshTrigger changes
  useEffect(() => {
    console.log('[InlineJobCostEntry] Effect triggered:', {
      jobsLength: jobs.length,
      startDate,
      endDate,
      facilitiesId
    });

    if (jobs.length > 0) {
      const loadEntriesWithCosts = async () => {
        const relevantJobs = getJobsInTimeRange(jobs, startDate, endDate);

        console.log('[InlineJobCostEntry] Relevant jobs in time range:', relevantJobs.length);

        // Fetch existing cost entries for this period from API
        try {
          const existingEntries = await getJobCostEntries(facilitiesId, startDate, endDate);

          console.log('[InlineJobCostEntry] Fetched existing entries:', existingEntries.length);

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

            console.log('[InlineJobCostEntry] Setting job entries:', entries.length);
            setJobEntries(entries);
          } catch (error) {
            console.error('[InlineJobCostEntry] Error loading cost entries:', error);
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
            console.log('[InlineJobCostEntry] Setting job entries (after error):', entries.length);
            setJobEntries(entries);
          }
        };

        loadEntriesWithCosts();
      } else {
        console.log('[InlineJobCostEntry] No jobs available');
      }
    }, [jobs, startDate, endDate, facilitiesId, refreshTrigger]);

  // Clear inputs when exiting batch mode
  useEffect(() => {
    if (!isBatchMode) {
      const newEntries = jobEntries.map(entry => ({
        ...entry,
        add_to_cost: '',
        set_total_cost: '',
        notes: '',
      }));
      setJobEntries(newEntries);
    }
  }, [isBatchMode]);

  // Handle input changes
  const handleAddToCostChange = (index: number, value: string) => {
    const validChars = value.replace(/[^\d.]/g, '');
    const parts = validChars.split('.');
    if (parts.length > 2) return;

    const newEntries = [...jobEntries];
    newEntries[index].add_to_cost = validChars;
    newEntries[index].set_total_cost = '';
    setJobEntries(newEntries);
  };

  const handleSetTotalCostChange = (index: number, value: string) => {
    const validChars = value.replace(/[^\d.]/g, '');
    const parts = validChars.split('.');
    if (parts.length > 2) return;

    const newEntries = [...jobEntries];
    newEntries[index].set_total_cost = validChars;
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

  // Handle batch save
  const handleBatchSave = async () => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      const entriesToSubmit = jobEntries
        .filter((entry) => entry.add_to_cost.trim() !== '' || entry.set_total_cost.trim() !== '')
        .map((entry) => {
          let final_cost_per_m: number;

          if (entry.add_to_cost.trim() !== '') {
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

          const costEntry: Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'> = {
            job: entry.job_id,
            date: Date.now(),
            actual_cost_per_m: final_cost_per_m,
            notes: entry.notes || undefined,
            facilities_id: facilitiesId,
          };

          return costEntry;
        });

      console.log('[InlineJobCostEntry] Entries to submit:', entriesToSubmit);

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
      console.log('[InlineJobCostEntry] Successfully created', createdEntries.length, 'entries');

      // Trigger refresh to fetch updated costs
      setRefreshTrigger(prev => prev + 1);

      // Show success
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        if (onSuccess) onSuccess();
        // Exit batch mode
        setIsBatchMode(false);
      }, 2000);
    } catch (error) {
      console.error('[InlineJobCostEntry] Error submitting:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save cost entries');
      setShowErrorToast(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchCancel = () => {
    setIsBatchMode(false);
  };

  console.log('[InlineJobCostEntry] Rendering, jobEntries.length:', jobEntries.length);

  if (jobEntries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No jobs found in the selected time period.</p>
          <p className="text-sm">Adjust your date range to see jobs available for cost tracking.</p>
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
              <span className="text-sm font-semibold text-blue-600">Batch Entry Mode</span>
              <span className="text-xs text-gray-500">Add to current or set new total for each job</span>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Job Cost Entry</h3>
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
                {submitting ? 'Saving...' : 'Save Changes'}
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
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Job #
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Billing Rate (per/M)
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                {isBatchMode ? 'Current Cost (per/M)' : 'Current Cost (per/M)'}
              </th>
              {isBatchMode ? (
                <>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Add to Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Set Total Cost
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Profit %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Notes
                  </th>
                </>
              ) : (
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Profit %
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobEntries.map((entry, index) => {
              const hasInput = entry.add_to_cost || entry.set_total_cost;
              const { profit, profitPercentage } = getProfitPreview(entry);
              const currentProfitPercentage = entry.billing_rate_per_m > 0
                ? ((entry.billing_rate_per_m - entry.current_cost_per_m) / entry.billing_rate_per_m) * 100
                : 0;

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
                    {entry.current_cost_per_m > 0 ? formatCurrency(entry.current_cost_per_m) : '—'}
                  </td>

                  {isBatchMode ? (
                    <>
                      {/* Add to Cost */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.add_to_cost}
                          onChange={(e) => handleAddToCostChange(index, e.target.value)}
                          placeholder="Add..."
                          className="w-24 px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>

                      {/* Set Total Cost */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.set_total_cost}
                          onChange={(e) => handleSetTotalCostChange(index, e.target.value)}
                          placeholder="Set..."
                          className="w-24 px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>

                      {/* Profit Preview */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                        <span className={hasInput ? getProfitTextColor(profitPercentage) : 'text-gray-400'}>
                          {hasInput ? formatPercentage(profitPercentage) : '—'}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.notes}
                          onChange={(e) => handleNotesChange(index, e.target.value)}
                          placeholder="Optional notes"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>
                    </>
                  ) : (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                      <span className={entry.current_cost_per_m > 0 ? getProfitTextColor(currentProfitPercentage) : 'text-gray-400'}>
                        {entry.current_cost_per_m > 0 ? formatPercentage(currentProfitPercentage) : '—'}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
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
