'use client';

import { useState, memo, useMemo } from 'react';
import { ParsedJob } from '@/hooks/useJobs';
import { JobProjection, ServiceTypeSummary } from '@/hooks/useProjections';
import { formatQuantity, TimeRange } from '@/lib/projectionUtils';
import JobDetailsModal from './JobDetailsModal';
import ProcessTypeBadge from './ProcessTypeBadge';

type SortField = 'job_number' | 'client' | 'description' | 'quantity' | 'start_date' | 'due_date' | 'total';
type SortDirection = 'asc' | 'desc';

interface ProjectionsTableProps {
  timeRanges: TimeRange[]; // Can be weeks, months, or quarters
  jobProjections: JobProjection[];
  serviceSummaries: ServiceTypeSummary[];
  grandTotals: {
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  };
  onRefresh: () => void;
  mobileViewMode?: 'cards' | 'table';
  globalTimeScrollIndex?: number;
  onGlobalTimeScrollIndexChange?: (index: number) => void;
  dataDisplayMode?: 'pieces' | 'revenue';
}

// Memoized desktop table row component
const ProjectionTableRow = memo(({
  projection,
  timeRanges,
  onJobClick,
  dataDisplayMode
}: {
  projection: JobProjection;
  timeRanges: TimeRange[];
  onJobClick: (job: ParsedJob) => void;
  dataDisplayMode: 'pieces' | 'revenue';
}) => {
  const job = projection.job;

  return (
    <tr
      key={job.id}
      className="cursor-pointer"
      onClick={() => onJobClick(job)}
    >
      <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]">
        {job.job_number}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]">
        {job.client?.name || 'Unknown'}
      </td>
      <td className="px-2 py-2 text-xs text-[var(--text-dark)]">
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
      <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[200px] truncate">
        {job.description || 'N/A'}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
        {job.quantity.toLocaleString()}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
        {job.start_date ? new Date(job.start_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : 'N/A'}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
        {job.due_date ? new Date(job.due_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : 'N/A'}
      </td>
      {timeRanges.map((range, index) => {
        const quantity = projection.weeklyQuantities.get(range.label) || 0;
        const revenue = projection.weeklyRevenues.get(range.label) || 0;
        const displayValue = dataDisplayMode === 'revenue'
          ? revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : formatQuantity(quantity);

        return (
          <td
            key={range.label}
            className={`px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)] ${
              index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'
            }`}
          >
            {displayValue}
          </td>
        );
      })}
      <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-bold text-[var(--text-dark)]">
        {dataDisplayMode === 'revenue'
          ? projection.totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : formatQuantity(projection.totalQuantity)}
      </td>
    </tr>
  );
});

ProjectionTableRow.displayName = 'ProjectionTableRow';

// Memoized mobile card component
const ProjectionMobileCard = memo(({
  projection,
  timeRanges,
  onJobClick,
  scrollPositions,
  onScrollPositionChange,
  dataDisplayMode
}: {
  projection: JobProjection;
  timeRanges: TimeRange[];
  onJobClick: (job: ParsedJob) => void;
  scrollPositions: Map<number, number>;
  onScrollPositionChange: (jobId: number, index: number) => void;
  dataDisplayMode: 'pieces' | 'revenue';
}) => {
  const job = projection.job;
  const [localScrollIndex, setLocalScrollIndex] = useState(scrollPositions.get(job.id) || 0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const VISIBLE_PERIODS = 6;
  const MIN_SWIPE_DISTANCE = 50;

  const handleScrollPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = Math.max(0, localScrollIndex - 1);
    setLocalScrollIndex(newIndex);
    onScrollPositionChange(job.id, newIndex);
  };

  const handleScrollNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = Math.min(timeRanges.length - VISIBLE_PERIODS, localScrollIndex + 1);
    setLocalScrollIndex(newIndex);
    onScrollPositionChange(job.id, newIndex);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > MIN_SWIPE_DISTANCE;
    const isRightSwipe = distance < -MIN_SWIPE_DISTANCE;

    if (isLeftSwipe && localScrollIndex < timeRanges.length - VISIBLE_PERIODS) {
      const newIndex = localScrollIndex + 1;
      setLocalScrollIndex(newIndex);
      onScrollPositionChange(job.id, newIndex);
    }

    if (isRightSwipe && localScrollIndex > 0) {
      const newIndex = localScrollIndex - 1;
      setLocalScrollIndex(newIndex);
      onScrollPositionChange(job.id, newIndex);
    }
  };

  const visibleTimeRanges = timeRanges.slice(localScrollIndex, localScrollIndex + VISIBLE_PERIODS);

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
          <div className="text-xs text-[var(--text-light)]">
            {dataDisplayMode === 'revenue' ? 'Total Revenue' : 'Total Quantity'}
          </div>
          <div className="text-sm font-bold text-[var(--text-dark)]">
            {dataDisplayMode === 'revenue'
              ? projection.totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : formatQuantity(projection.totalQuantity)}
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

      {/* Time Range Breakdown with navigation */}
      {timeRanges.length > 0 && (
        <div
          className="border-t border-[var(--border)] pt-3"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-[var(--text-light)]">Period Breakdown</div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleScrollPrevious}
                disabled={localScrollIndex === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous periods"
              >
                <svg className="w-4 h-4 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs text-[var(--text-light)] min-w-[60px] text-center">
                {localScrollIndex + 1}-{Math.min(localScrollIndex + VISIBLE_PERIODS, timeRanges.length)} of {timeRanges.length}
              </span>
              <button
                onClick={handleScrollNext}
                disabled={localScrollIndex + VISIBLE_PERIODS >= timeRanges.length}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next periods"
              >
                <svg className="w-4 h-4 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {visibleTimeRanges.map(range => {
              const quantity = projection.weeklyQuantities.get(range.label) || 0;
              const revenue = projection.weeklyRevenues.get(range.label) || 0;
              const hasValue = dataDisplayMode === 'revenue' ? revenue > 0 : quantity > 0;
              const displayValue = dataDisplayMode === 'revenue'
                ? revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
                : formatQuantity(quantity);

              return hasValue ? (
                <div key={range.label} className="text-center">
                  <div className="text-[var(--text-light)] text-[10px]">{range.label}</div>
                  <div className="font-medium text-[var(--text-dark)]">{displayValue}</div>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ProjectionMobileCard.displayName = 'ProjectionMobileCard';

// Memoized mobile table row component
const MobileTableRow = memo(({
  projection,
  visibleTimeRanges,
  onJobClick,
  dataDisplayMode
}: {
  projection: JobProjection;
  visibleTimeRanges: TimeRange[];
  onJobClick: (job: ParsedJob) => void;
  dataDisplayMode: 'pieces' | 'revenue';
}) => {
  const job = projection.job;

  return (
    <tr
      className="cursor-pointer border-b border-[var(--border)] hover:bg-gray-50"
      onClick={() => onJobClick(job)}
    >
      <td className="px-2 py-2 text-xs font-medium text-[var(--text-dark)] sticky left-0 bg-white">
        {job.job_number}
      </td>
      <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[80px] truncate">
        {job.client?.name || 'Unknown'}
      </td>
      {visibleTimeRanges.map((range, index) => {
        const quantity = projection.weeklyQuantities.get(range.label) || 0;
        const revenue = projection.weeklyRevenues.get(range.label) || 0;
        const displayValue = dataDisplayMode === 'revenue'
          ? revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : formatQuantity(quantity);

        return (
          <td
            key={range.label}
            className={`px-2 py-2 text-xs text-center font-medium text-[var(--text-dark)] ${
              index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'
            }`}
          >
            {displayValue}
          </td>
        );
      })}
      <td className="px-2 py-2 text-xs text-center font-bold text-[var(--text-dark)] sticky right-0 bg-white">
        {dataDisplayMode === 'revenue'
          ? projection.totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : formatQuantity(projection.totalQuantity)}
      </td>
    </tr>
  );
});

MobileTableRow.displayName = 'MobileTableRow';

export default function ProjectionsTable({
  timeRanges,
  jobProjections,
  onRefresh,
  mobileViewMode = 'cards',
  globalTimeScrollIndex = 0,
  onGlobalTimeScrollIndexChange,
  dataDisplayMode = 'pieces',
}: ProjectionsTableProps) {
  const [selectedJob, setSelectedJob] = useState<ParsedJob | null>(null);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('job_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [cardScrollPositions, setCardScrollPositions] = useState<Map<number, number>>(new Map());

  const VISIBLE_PERIODS = 3; // For mobile table view

  const handleJobClick = (job: ParsedJob) => {
    setSelectedJob(job);
    setIsJobDetailsOpen(true);
  };

  const handleCloseModal = () => {
    setIsJobDetailsOpen(false);
    setSelectedJob(null);
  };

  const handleCardScrollPositionChange = (jobId: number, index: number) => {
    setCardScrollPositions(prev => {
      const newMap = new Map(prev);
      newMap.set(jobId, index);
      return newMap;
    });
  };

  const handleGlobalScrollPrevious = () => {
    if (onGlobalTimeScrollIndexChange && globalTimeScrollIndex > 0) {
      onGlobalTimeScrollIndexChange(globalTimeScrollIndex - 1);
    }
  };

  const handleGlobalScrollNext = () => {
    if (onGlobalTimeScrollIndexChange && globalTimeScrollIndex < timeRanges.length - VISIBLE_PERIODS) {
      onGlobalTimeScrollIndexChange(globalTimeScrollIndex + 1);
    }
  };

  // Calculate visible time ranges for mobile table view
  const mobileTableVisibleRanges = timeRanges.slice(globalTimeScrollIndex, globalTimeScrollIndex + VISIBLE_PERIODS);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort job projections
  const sortedJobProjections = useMemo(() => {
    return [...jobProjections].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'job_number':
          aValue = a.job.job_number;
          bValue = b.job.job_number;
          break;
        case 'client':
          aValue = a.job.client?.name.toLowerCase() || '';
          bValue = b.job.client?.name.toLowerCase() || '';
          break;
        case 'description':
          aValue = a.job.description?.toLowerCase() || '';
          bValue = b.job.description?.toLowerCase() || '';
          break;
        case 'quantity':
          aValue = a.job.quantity;
          bValue = b.job.quantity;
          break;
        case 'start_date':
          aValue = a.job.start_date || 0;
          bValue = b.job.start_date || 0;
          break;
        case 'due_date':
          aValue = a.job.due_date || 0;
          bValue = b.job.due_date || 0;
          break;
        case 'total':
          aValue = a.totalQuantity;
          bValue = b.totalQuantity;
          break;
        default:
          aValue = a.job.job_number;
          bValue = b.job.job_number;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [jobProjections, sortField, sortDirection]);

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow-sm border border-[var(--border)]">
          <thead>
            {/* Column Headers */}
            <tr className="bg-gray-50 border-y border-gray-200">
              <th
                onClick={() => handleSort('job_number')}
                className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Job # <SortIcon field="job_number" />
                </div>
              </th>
              <th
                onClick={() => handleSort('client')}
                className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Client <SortIcon field="client" />
                </div>
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider">
                Processes
              </th>
              <th
                onClick={() => handleSort('description')}
                className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Description <SortIcon field="description" />
                </div>
              </th>
              <th
                onClick={() => handleSort('quantity')}
                className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  Qty <SortIcon field="quantity" />
                </div>
              </th>
              <th
                onClick={() => handleSort('start_date')}
                className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  Start <SortIcon field="start_date" />
                </div>
              </th>
              <th
                onClick={() => handleSort('due_date')}
                className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  End <SortIcon field="due_date" />
                </div>
              </th>
              {timeRanges.map((range, index) => (
                <th
                  key={range.label}
                  className={`px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider ${
                    index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'
                  }`}
                >
                  {range.label}
                </th>
              ))}
              <th
                onClick={() => handleSort('total')}
                className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  Total <SortIcon field="total" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {sortedJobProjections.length === 0 ? (
              <tr>
                <td colSpan={8 + timeRanges.length} className="px-4 py-8 text-center text-[var(--text-light)]">
                  No jobs found for the selected criteria
                </td>
              </tr>
            ) : (
              sortedJobProjections.map((projection) => (
                <ProjectionTableRow
                  key={projection.job.id}
                  projection={projection}
                  timeRanges={timeRanges}
                  onJobClick={handleJobClick}
                  dataDisplayMode={dataDisplayMode}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {/* Global Time Navigation for Mobile */}
        {mobileViewMode === 'table' && timeRanges.length > VISIBLE_PERIODS && (
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--text-light)]">Showing Periods</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGlobalScrollPrevious}
                  disabled={globalTimeScrollIndex === 0}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous periods"
                >
                  <svg className="w-5 h-5 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-[var(--text-dark)] min-w-[80px] text-center">
                  {globalTimeScrollIndex + 1}-{Math.min(globalTimeScrollIndex + VISIBLE_PERIODS, timeRanges.length)} of {timeRanges.length}
                </span>
                <button
                  onClick={handleGlobalScrollNext}
                  disabled={globalTimeScrollIndex + VISIBLE_PERIODS >= timeRanges.length}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next periods"
                >
                  <svg className="w-5 h-5 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Table View */}
        {mobileViewMode === 'table' ? (
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-[var(--border)]">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase sticky left-0 bg-gray-50">
                    Job #
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase">
                    Client
                  </th>
                  {mobileTableVisibleRanges.map((range, index) => (
                    <th
                      key={range.label}
                      className={`px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase ${
                        index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'
                      }`}
                    >
                      {range.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-[10px] font-medium text-[var(--text-dark)] uppercase sticky right-0 bg-gray-50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedJobProjections.length === 0 ? (
                  <tr>
                    <td colSpan={5 + VISIBLE_PERIODS} className="px-4 py-8 text-center text-[var(--text-light)]">
                      No jobs found for the selected criteria
                    </td>
                  </tr>
                ) : (
                  sortedJobProjections.map((projection) => (
                    <MobileTableRow
                      key={projection.job.id}
                      projection={projection}
                      visibleTimeRanges={mobileTableVisibleRanges}
                      onJobClick={handleJobClick}
                      dataDisplayMode={dataDisplayMode}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Mobile Card View */
          <div className="space-y-4">
            {sortedJobProjections.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6 text-center text-[var(--text-light)]">
                No jobs found for the selected criteria
              </div>
            ) : (
              sortedJobProjections.map((projection) => (
                <ProjectionMobileCard
                  key={projection.job.id}
                  projection={projection}
                  timeRanges={timeRanges}
                  onJobClick={handleJobClick}
                  scrollPositions={cardScrollPositions}
                  onScrollPositionChange={handleCardScrollPositionChange}
                  dataDisplayMode={dataDisplayMode}
                />
              ))
            )}
          </div>
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
