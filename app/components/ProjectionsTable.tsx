'use client';

import { useState } from 'react';
import { ParsedJob } from '@/hooks/useJobs';
import { JobProjection, ServiceTypeSummary } from '@/hooks/useProjections';
import { formatQuantity, TimeRange } from '@/lib/projectionUtils';
import JobDetailsModal from './JobDetailsModal';
import ProcessTypeBadge from './ProcessTypeBadge';

interface ProjectionsTableProps {
  timeRanges: TimeRange[]; // Can be weeks, months, or quarters
  jobProjections: JobProjection[];
  serviceSummaries: ServiceTypeSummary[];
  grandTotals: {
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  };
  onRefresh: () => void;
}

export default function ProjectionsTable({
  timeRanges,
  jobProjections,
  onRefresh,
}: ProjectionsTableProps) {
  const [selectedJob, setSelectedJob] = useState<ParsedJob | null>(null);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);

  const handleJobClick = (job: ParsedJob) => {
    setSelectedJob(job);
    setIsJobDetailsOpen(true);
  };

  const handleCloseModal = () => {
    setIsJobDetailsOpen(false);
    setSelectedJob(null);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow-sm border border-[var(--border)]">
          <thead>
            {/* Column Headers */}
            <tr className="bg-gray-50 border-y border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Job #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Sub Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Process Types
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Job Name / Description
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Start Date
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                End Date
              </th>
              {timeRanges.map(range => (
                <th key={range.label} className="px-4 py-3 text-center text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                  {range.label}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {jobProjections.length === 0 ? (
              <tr>
                <td colSpan={8 + timeRanges.length} className="px-4 py-8 text-center text-[var(--text-light)]">
                  No jobs found for the selected criteria
                </td>
              </tr>
            ) : (
              jobProjections.map((projection) => {
                const job = projection.job;

                return (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleJobClick(job)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[var(--text-dark)]">
                      {job.job_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {job.client?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-dark)]">
                      <div className="flex flex-wrap gap-1">
                        {job.requirements && job.requirements.length > 0 ? (
                          // Get unique process types from requirements
                          [...new Set(job.requirements.map(req => req.process_type).filter(Boolean))].map((processType, idx) => (
                            <ProcessTypeBadge key={idx} processType={processType as string} />
                          ))
                        ) : (
                          <span className="text-gray-400 text-xs">No processes</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-dark)] max-w-xs truncate">
                      {job.description || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-[var(--text-dark)]">
                      {job.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-[var(--text-dark)]">
                      {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-[var(--text-dark)]">
                      {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'N/A'}
                    </td>
                    {timeRanges.map(range => {
                      const quantity = projection.weeklyQuantities.get(range.label) || 0;
                      return (
                        <td
                          key={range.label}
                          className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-[var(--text-dark)]"
                        >
                          {formatQuantity(quantity)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-[var(--text-dark)]">
                      {formatQuantity(projection.totalQuantity)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Job Details Modal */}
      <JobDetailsModal
        isOpen={isJobDetailsOpen}
        job={selectedJob}
        onClose={handleCloseModal}
        onRefresh={onRefresh}
      />
    </>
  );
}
