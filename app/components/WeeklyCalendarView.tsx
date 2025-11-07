'use client';

import { useMemo } from 'react';
import { ParsedJob } from '@/hooks/useJobs';
import { PROCESS_TYPE_CONFIGS, getProcessTypeColor } from '@/lib/processTypeConfig';
import { startOfWeek, endOfWeek, isWithinInterval, addWeeks, format } from 'date-fns';

interface WeeklyCalendarViewProps {
  jobs: ParsedJob[];
  startDate?: Date;
}

interface WeekData {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  label: string;
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

export default function WeeklyCalendarView({ jobs, startDate }: WeeklyCalendarViewProps) {
  const weeklyData = useMemo(() => {
    // Determine the base date for calculating weeks
    const baseDate = startDate || new Date();
    const firstWeekStart = startOfWeek(baseDate);

    // Generate 5 weeks starting from the base week
    const weeks: WeekData[] = Array.from({ length: 5 }, (_, i) => {
      const weekStart = addWeeks(firstWeekStart, i);
      const weekEnd = endOfWeek(weekStart);

      return {
        weekNumber: i + 1,
        weekStart,
        weekEnd,
        label: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
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

      // Determine which weeks this job spans
      weeks.forEach(weekData => {
        // Check if job overlaps with this week
        const jobOverlaps =
          isWithinInterval(jobStart, { start: weekData.weekStart, end: weekData.weekEnd }) ||
          isWithinInterval(jobEnd, { start: weekData.weekStart, end: weekData.weekEnd }) ||
          (jobStart <= weekData.weekStart && jobEnd >= weekData.weekEnd);

        if (jobOverlaps) {
          // Calculate revenue from requirements.price_per_m
          const revenue = job.requirements?.reduce((total, req) => {
            const pricePerMStr = req.price_per_m;
            const isValidPrice = pricePerMStr && pricePerMStr !== 'undefined' && pricePerMStr !== 'null';
            const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
            return total + ((job.quantity / 1000) * pricePerM);
          }, 0) || 0;
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
            if (weekData.processTypes[processType]) {
              weekData.processTypes[processType].pieces += pieces;
              weekData.processTypes[processType].revenue += revenue;
            }
          });

          // Add to total
          weekData.total.pieces += pieces;
          weekData.total.revenue += revenue;
        }
      });
    });

    return weeks;
  }, [jobs, startDate]);

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
    <div className="weekly-calendar-view bg-white rounded-lg border border-[var(--border)] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-[var(--border)] px-4 py-3 text-left text-sm font-bold text-[var(--dark-blue)] sticky left-0 bg-gray-50 z-10">
                Process Type
              </th>
              {weeklyData.map((week) => (
                <th
                  key={`week-${week.weekNumber}`}
                  className="border border-[var(--border)] px-6 py-3 text-center text-sm font-bold text-[var(--dark-blue)] min-w-[200px]"
                >
                  <div>Week {week.weekNumber}</div>
                  <div className="text-xs font-normal text-gray-600 mt-1">{week.label}</div>
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
                {weeklyData.map((week) => {
                  const data = week.processTypes[processType.key];
                  return (
                    <td
                      key={`${processType.key}-week-${week.weekNumber}`}
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
              {weeklyData.map((week) => (
                <td
                  key={`total-week-${week.weekNumber}`}
                  className="border border-[var(--border)] px-6 py-4 text-center"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[var(--dark-blue)]">
                      {formatNumber(week.total.pieces)} pcs
                    </div>
                    <div className="text-sm font-bold text-[var(--primary-blue)]">
                      {formatCurrency(week.total.revenue)}
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
