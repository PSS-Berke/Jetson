'use client';

import React from 'react';
import { ParsedJob } from '@/hooks/useJobs';
import { formatCurrency, formatPercentage } from '@/lib/cfoUtils';

interface AlertDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  jobs: ParsedJob[];
  type: 'jobs-at-risk' | 'client-concentration' | 'process-concentration' | 'total-clients' | 'top-client' | 'primary-process' | 'revenue-per-job' | 'total-volume' | 'period-growth' | 'profit-margin' | 'job-clustering';
  additionalData?: {
    clientName?: string;
    processType?: string;
    concentration?: number;
    revenueAtRisk?: number;
    profitMargin?: number;
    periodLabel?: string;
  };
}

export default function AlertDetailsModal({
  isOpen,
  onClose,
  title,
  description,
  jobs,
  type,
  additionalData,
}: AlertDetailsModalProps) {
  if (!isOpen) return null;

  const calculateJobProfit = (job: ParsedJob): number => {
    // Calculate billing rate and cost from job data
    const billingRate = job.billing_rate || 0;
    const estimatedCost = job.estimated_cost || 0;
    return billingRate - estimatedCost;
  };

  const calculateProfitPercentage = (job: ParsedJob): number => {
    const billingRate = job.billing_rate || 0;
    if (billingRate === 0) return 0;
    const profit = calculateJobProfit(job);
    return (profit / billingRate) * 100;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

      {/* Modal */}
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          {/* Header */}
          <div className="bg-white px-6 pt-6 pb-4 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900" id="modal-title">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{description}</p>
              </div>
              <button
                onClick={onClose}
                className="ml-4 text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {/* Summary Stats */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium">Total Jobs</div>
                <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
              </div>
              {type === 'jobs-at-risk' && additionalData?.revenueAtRisk && (
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xs text-red-700 font-medium">Revenue at Risk</div>
                  <div className="text-2xl font-bold text-red-900">
                    {formatCurrency(additionalData.revenueAtRisk, true)}
                  </div>
                </div>
              )}
              {type === 'client-concentration' && additionalData?.concentration && (
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="text-xs text-orange-700 font-medium">Revenue Concentration</div>
                  <div className="text-2xl font-bold text-orange-900">
                    {formatPercentage(additionalData.concentration)}
                  </div>
                </div>
              )}
              {type === 'process-concentration' && additionalData?.concentration && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-700 font-medium">Process Concentration</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatPercentage(additionalData.concentration)}
                  </div>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium">Total Revenue</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(jobs.reduce((sum, job) => sum + (job.billing_rate || 0), 0), true)}
                </div>
              </div>
            </div>
          </div>

          {/* Job List */}
          <div className="bg-white px-6 py-4 max-h-96 overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Job #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Job Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Revenue
                    </th>
                    {type === 'jobs-at-risk' && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Profit %
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job, index) => {
                    const profitPercentage = calculateProfitPercentage(job);
                    return (
                      <tr key={job.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {job.job_number}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {job.job_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {job.client?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                          {job.quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(job.billing_rate || 0, true)}
                        </td>
                        {type === 'jobs-at-risk' && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-right">
                            <span className={profitPercentage < 20 ? 'text-red-600' : profitPercentage < 30 ? 'text-yellow-600' : 'text-green-600'}>
                              {formatPercentage(profitPercentage)}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
