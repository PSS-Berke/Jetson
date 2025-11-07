'use client';

import { useMemo } from 'react';
import { ParsedJob } from '@/hooks/useJobs';
import { PROCESS_TYPE_CONFIGS, getProcessTypeColor } from '@/lib/processTypeConfig';
import { startOfQuarter, endOfQuarter, isWithinInterval, addQuarters } from 'date-fns';

interface QuarterlyCalendarViewProps {
  jobs: ParsedJob[];
  year?: number; // Keep for backward compatibility
  startDate?: Date; // New prop to control which quarters to show
}

interface QuarterData {
  quarter: number;
  year: number;
  processTypes: {
    [key: string]: {
      pieces: number;
      revenue: number;
    };
  };
  total: {
    pieces: number;
    revenue: number;
  };
}

// Use config for process types
const PROCESS_TYPES = PROCESS_TYPE_CONFIGS.map(config => ({
  key: config.key,
  label: config.label
}));

export default function QuarterlyCalendarView({ jobs, year, startDate }: QuarterlyCalendarViewProps) {
  const quarterlyData = useMemo(() => {
    // Determine the base date for calculating quarters
    const baseDate = startDate || new Date(year || new Date().getFullYear(), 0, 1);
    const firstQuarterStart = startOfQuarter(baseDate);

    // Generate 4 quarters starting from the base quarter
    const quarters: QuarterData[] = Array.from({ length: 4 }, (_, i) => {
      const quarterStart = addQuarters(firstQuarterStart, i);
      const quarterNum = Math.floor(quarterStart.getMonth() / 3) + 1;
      const quarterYear = quarterStart.getFullYear();

      return {
        quarter: quarterNum,
        year: quarterYear,
        processTypes: {
          insert: { pieces: 0, revenue: 0 },
          sort: { pieces: 0, revenue: 0 },
          inkjet: { pieces: 0, revenue: 0 },
          labelApply: { pieces: 0, revenue: 0 },
          fold: { pieces: 0, revenue: 0 },
          laser: { pieces: 0, revenue: 0 },
          hpPress: { pieces: 0, revenue: 0 },
        },
        total: { pieces: 0, revenue: 0 },
      };
    });

    // Process each job
    jobs.forEach((job) => {
      const jobStart = new Date(job.start_date);
      const jobEnd = new Date(job.due_date);

      // Determine which quarters this job spans
      quarters.forEach(quarterData => {
        const quarterStart = startOfQuarter(new Date(quarterData.year, (quarterData.quarter - 1) * 3, 1));
        const quarterEnd = endOfQuarter(quarterStart);

        // Check if job overlaps with this quarter
        const jobOverlaps =
          isWithinInterval(jobStart, { start: quarterStart, end: quarterEnd }) ||
          isWithinInterval(jobEnd, { start: quarterStart, end: quarterEnd }) ||
          (jobStart <= quarterStart && jobEnd >= quarterEnd);

        if (jobOverlaps) {
          const revenue = parseFloat(job.total_billing) || 0;
          const pieces = job.quantity || 0;

          // Get process types from requirements
          const processTypes = new Set<string>();
          job.requirements?.forEach((req) => {
            if (req.process_type) {
              const normalized = req.process_type.toLowerCase();
              // Normalize variations
              if (normalized.includes('inkjet') || normalized === 'ij') {
                processTypes.add('inkjet');
              } else if (normalized.includes('label')) {
                processTypes.add('labelApply');
              } else if (normalized.includes('hp')) {
                processTypes.add('hpPress');
              } else if (['insert', 'sort', 'fold', 'laser'].includes(normalized)) {
                processTypes.add(normalized);
              }
            }
          });

          // Add to each process type this job uses
          processTypes.forEach(processType => {
            if (quarterData.processTypes[processType]) {
              quarterData.processTypes[processType].pieces += pieces;
              quarterData.processTypes[processType].revenue += revenue;
            }
          });

          // Add to total
          quarterData.total.pieces += pieces;
          quarterData.total.revenue += revenue;
        }
      });
    });

    return quarters;
  }, [jobs, year, startDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  return (
    <div className="quarterly-calendar-view bg-white rounded-lg border border-[var(--border)] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-[var(--border)] px-4 py-3 text-left text-sm font-bold text-[var(--dark-blue)] sticky left-0 bg-gray-50 z-10">
                Process Type
              </th>
              {quarterlyData.map((quarter) => (
                <th
                  key={`${quarter.year}-${quarter.quarter}`}
                  className="border border-[var(--border)] px-6 py-3 text-center text-sm font-bold text-[var(--dark-blue)] min-w-[200px]"
                >
                  Q{quarter.quarter} {quarter.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROCESS_TYPES.map((processType) => (
              <tr key={processType.key} className="hover:bg-gray-50 transition-colors">
                <td
                  className="border border-[var(--border)] px-4 py-3 font-semibold text-sm sticky left-0 bg-white z-10"
                  style={{ color: getProcessTypeColor(processType.key) }}
                >
                  {processType.label}
                </td>
                {quarterlyData.map((quarter) => {
                  const data = quarter.processTypes[processType.key];
                  return (
                    <td
                      key={`${processType.key}-${quarter.quarter}`}
                      className="border border-[var(--border)] px-6 py-4 text-center"
                    >
                      {data && (data.pieces > 0 || data.revenue > 0) ? (
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-[var(--text-dark)]">
                            {formatNumber(data.pieces)} pcs
                          </div>
                          <div
                            className="text-sm font-bold"
                            style={{ color: getProcessTypeColor(processType.key) }}
                          >
                            {formatCurrency(data.revenue)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Total Row */}
            <tr className="bg-blue-50 font-bold">
              <td className="border border-[var(--border)] px-4 py-3 text-sm text-[var(--dark-blue)] sticky left-0 bg-blue-50 z-10">
                Total
              </td>
              {quarterlyData.map((quarter) => (
                <td
                  key={`total-${quarter.quarter}`}
                  className="border border-[var(--border)] px-6 py-4 text-center"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[var(--dark-blue)]">
                      {formatNumber(quarter.total.pieces)} pcs
                    </div>
                    <div className="text-sm font-bold text-[var(--primary-blue)]">
                      {formatCurrency(quarter.total.revenue)}
                    </div>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
