'use client';

import { useState, memo } from 'react';
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

// Memoized desktop table row component
const ProjectionTableRow = memo(({
  projection,
  timeRanges,
  onJobClick
}: {
  projection: JobProjection;
  timeRanges: TimeRange[];
  onJobClick: (job: ParsedJob) => void;
}) => {
  const job = projection.job;

  return (
    <tr
      key={job.id}
      className="cursor-pointer"
      onClick={() => onJobClick(job)}
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
      {timeRanges.map((range, index) => {
        const quantity = projection.weeklyQuantities.get(range.label) || 0;
        return (
          <td
            key={range.label}
            className={`px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-[var(--text-dark)] ${
              index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'
            }`}
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
});

ProjectionTableRow.displayName = 'ProjectionTableRow';

// Memoized mobile card component
const ProjectionMobileCard = memo(({
  projection,
  timeRanges,
  onJobClick
}: {
  projection: JobProjection;
  timeRanges: TimeRange[];
  onJobClick: (job: ParsedJob) => void;
}) => {
  const job = projection.job;

  return (
    <div
      key={job.id}
      className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onJobClick(job)}
    >
      {/* Job Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-dark)]">
            Job #{job.job_number}
          </div>
          <div className="text-xs text-[var(--text-light)] mt-1">
            {job.client?.name || 'Unknown'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--text-light)]">Total Quantity</div>
          <div className="text-sm font-bold text-[var(--text-dark)]">
            {formatQuantity(projection.totalQuantity)}
          </div>
        </div>
      </div>

      {/* Job Description */}
      <div className="mb-3">
        <div className="text-sm text-[var(--text-dark)] line-clamp-2">
          {job.description || 'N/A'}
        </div>
      </div>

      {/* Process Types */}
      <div className="mb-3">
        <div className="text-xs text-[var(--text-light)] mb-1">Process Types</div>
        <div className="flex flex-wrap gap-1">
          {job.requirements && job.requirements.length > 0 ? (
            [...new Set(job.requirements.map(req => req.process_type).filter(Boolean))].map((processType, idx) => (
              <ProcessTypeBadge key={idx} processType={processType as string} />
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
            {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'N/A'}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-[var(--text-light)]">End Date</div>
          <div className="text-[var(--text-dark)]">
            {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Time Range Breakdown (collapsed by default, shown on tap) */}
      {timeRanges.length > 0 && (
        <div className="border-t border-[var(--border)] pt-3">
          <div className="text-xs text-[var(--text-light)] mb-2">Weekly Breakdown</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {timeRanges.slice(0, 6).map(range => {
              const quantity = projection.weeklyQuantities.get(range.label) || 0;
              return quantity > 0 ? (
                <div key={range.label} className="text-center">
                  <div className="text-[var(--text-light)] text-[10px]">{range.label}</div>
                  <div className="font-medium text-[var(--text-dark)]">{formatQuantity(quantity)}</div>
                </div>
              ) : null;
            })}
          </div>
          {timeRanges.length > 6 && (
            <div className="text-xs text-center text-[var(--text-light)] mt-2">
              Tap for full details
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ProjectionMobileCard.displayName = 'ProjectionMobileCard';

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
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
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
              {timeRanges.map((range, index) => (
                <th
                  key={range.label}
                  className={`px-4 py-3 text-center text-xs font-medium text-[var(--text-dark)] uppercase tracking-wider ${
                    index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'
                  }`}
                >
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
              jobProjections.map((projection) => (
                <ProjectionTableRow
                  key={projection.job.id}
                  projection={projection}
                  timeRanges={timeRanges}
                  onJobClick={handleJobClick}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {jobProjections.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6 text-center text-[var(--text-light)]">
            No jobs found for the selected criteria
          </div>
        ) : (
          jobProjections.map((projection) => (
            <ProjectionMobileCard
              key={projection.job.id}
              projection={projection}
              timeRanges={timeRanges}
              onJobClick={handleJobClick}
            />
          ))
        )}
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
