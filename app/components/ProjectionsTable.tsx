'use client';

import { useState } from 'react';
import { ParsedJob } from '@/hooks/useJobs';
import { WeekRange, JobProjection, ServiceTypeSummary } from '@/hooks/useProjections';
import { formatQuantity } from '@/lib/projectionUtils';
import JobDetailsModal from './JobDetailsModal';

interface ProjectionsTableProps {
  weekRanges: WeekRange[];
  jobProjections: JobProjection[];
  serviceSummaries: ServiceTypeSummary[];
  grandTotals: {
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  };
  onRefresh: () => void;
}

export default function ProjectionsTable({
  weekRanges,
  jobProjections,
  serviceSummaries,
  grandTotals,
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
            {/* Summary Rows */}
            <tr className="bg-green-100 border-b-2 border-green-300">
              <th className="px-4 py-3 text-left text-sm font-bold text-[var(--dark-blue)] uppercase" colSpan={7}>
                Summary by Service Type
              </th>
              {weekRanges.map(week => (
                <th key={week.label} className="px-4 py-3 text-center text-sm font-bold text-[var(--dark-blue)]">
                  {formatQuantity(grandTotals.weeklyTotals.get(week.label) || 0)}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-sm font-bold text-[var(--dark-blue)]">
                {formatQuantity(grandTotals.grandTotal)}
              </th>
            </tr>

            {/* Service Type Summary Rows */}
            {serviceSummaries.map(summary => (
              <tr key={summary.serviceType} className="bg-green-50 border-b border-green-200">
                <td className="px-4 py-2 text-left text-sm font-semibold text-[var(--text-dark)]" colSpan={7}>
                  TOTAL {summary.serviceType.toUpperCase()}
                </td>
                {weekRanges.map(week => (
                  <td key={week.label} className="px-4 py-2 text-center text-sm font-semibold text-[var(--text-dark)]">
                    {formatQuantity(summary.weeklyTotals.get(week.label) || 0)}
                  </td>
                ))}
                <td className="px-4 py-2 text-center text-sm font-semibold text-[var(--text-dark)]">
                  {formatQuantity(summary.grandTotal)}
                </td>
              </tr>
            ))}

            {/* Column Headers */}
            <tr className="bg-cyan-100 border-y-2 border-cyan-300">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Job #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Sub Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Type
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
              {weekRanges.map(week => (
                <th key={week.label} className="px-4 py-3 text-center text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider">
                  {week.label}
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
                <td colSpan={8 + weekRanges.length} className="px-4 py-8 text-center text-[var(--text-light)]">
                  No jobs found for the selected criteria
                </td>
              </tr>
            ) : (
              jobProjections.map((projection, index) => {
                const job = projection.job;
                const isEvenRow = index % 2 === 0;

                return (
                  <tr
                    key={job.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      isEvenRow ? 'bg-green-50' : 'bg-green-100'
                    }`}
                    onClick={() => handleJobClick(job)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[var(--text-dark)]">
                      {job.job_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {job.client?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {job.service_type}
                      </span>
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
                    {weekRanges.map(week => {
                      const quantity = projection.weeklyQuantities.get(week.label) || 0;
                      return (
                        <td
                          key={week.label}
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
