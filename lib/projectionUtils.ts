import { ParsedJob } from '@/hooks/useJobs';
import { getDateKey, getDaysBetween } from './dateUtils';

export interface WeekRange {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  label: string; // e.g., "8/25", "9/1"
}

export interface JobProjection {
  job: ParsedJob;
  weeklyQuantities: Map<string, number>; // weekLabel -> quantity
  totalQuantity: number;
}

export interface ServiceTypeSummary {
  serviceType: string;
  weeklyTotals: Map<string, number>; // weekLabel -> total quantity
  grandTotal: number;
}

/**
 * Generate 5 consecutive week ranges starting from a given date
 */
export function generateWeekRanges(startDate: Date): WeekRange[] {
  const weeks: WeekRange[] = [];
  const baseDate = new Date(startDate);

  // Normalize to start of day
  baseDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < 5; i++) {
    const weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() + (i * 7));

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Format label as M/D (e.g., "8/25", "9/1")
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

    weeks.push({
      weekNumber: i + 1,
      startDate: weekStart,
      endDate: weekEnd,
      label,
    });
  }

  return weeks;
}

/**
 * Calculate how much of a job's quantity falls within each week
 */
export function calculateJobWeeklyDistribution(
  job: ParsedJob,
  weekRanges: WeekRange[]
): Map<string, number> {
  const weeklyQuantities = new Map<string, number>();

  // Initialize all weeks to 0
  weekRanges.forEach(week => {
    weeklyQuantities.set(week.label, 0);
  });

  // If job has no dates or quantity, return zeros
  if (!job.start_date || !job.due_date || !job.quantity) {
    return weeklyQuantities;
  }

  const jobStart = new Date(job.start_date);
  const jobEnd = new Date(job.due_date);

  // Normalize to start of day
  jobStart.setHours(0, 0, 0, 0);
  jobEnd.setHours(0, 0, 0, 0);

  // Get all days the job spans
  const jobDays = getDaysBetween(jobStart, jobEnd);
  const totalJobDays = jobDays.length;

  if (totalJobDays === 0) {
    return weeklyQuantities;
  }

  // Calculate daily quantity
  const dailyQuantity = job.quantity / totalJobDays;

  // For each week, count how many job days fall within it
  weekRanges.forEach(week => {
    let daysInWeek = 0;

    jobDays.forEach(day => {
      const dayTime = day.getTime();
      if (dayTime >= week.startDate.getTime() && dayTime <= week.endDate.getTime()) {
        daysInWeek++;
      }
    });

    const weekQuantity = Math.round(dailyQuantity * daysInWeek);
    weeklyQuantities.set(week.label, weekQuantity);
  });

  return weeklyQuantities;
}

/**
 * Calculate projections for all jobs
 */
export function calculateJobProjections(
  jobs: ParsedJob[],
  weekRanges: WeekRange[]
): JobProjection[] {
  return jobs.map(job => {
    const weeklyQuantities = calculateJobWeeklyDistribution(job, weekRanges);

    // Calculate total from weekly quantities (may differ slightly from job.quantity due to rounding)
    let totalQuantity = 0;
    weeklyQuantities.forEach(qty => {
      totalQuantity += qty;
    });

    return {
      job,
      weeklyQuantities,
      totalQuantity,
    };
  });
}

/**
 * Aggregate projections by service type to create summary rows
 */
export function calculateServiceTypeSummaries(
  jobProjections: JobProjection[],
  weekRanges: WeekRange[]
): ServiceTypeSummary[] {
  const summaryMap = new Map<string, ServiceTypeSummary>();

  jobProjections.forEach(projection => {
    const serviceType = projection.job.service_type || 'Unknown';

    if (!summaryMap.has(serviceType)) {
      const weeklyTotals = new Map<string, number>();
      weekRanges.forEach(week => {
        weeklyTotals.set(week.label, 0);
      });

      summaryMap.set(serviceType, {
        serviceType,
        weeklyTotals,
        grandTotal: 0,
      });
    }

    const summary = summaryMap.get(serviceType)!;

    // Add this job's weekly quantities to the service type totals
    projection.weeklyQuantities.forEach((quantity, weekLabel) => {
      const currentTotal = summary.weeklyTotals.get(weekLabel) || 0;
      summary.weeklyTotals.set(weekLabel, currentTotal + quantity);
    });

    summary.grandTotal += projection.totalQuantity;
  });

  // Convert to array and sort by service type name
  return Array.from(summaryMap.values()).sort((a, b) =>
    a.serviceType.localeCompare(b.serviceType)
  );
}

/**
 * Calculate grand totals across all service types
 */
export function calculateGrandTotals(
  summaries: ServiceTypeSummary[],
  weekRanges: WeekRange[]
): { weeklyTotals: Map<string, number>; grandTotal: number } {
  const weeklyTotals = new Map<string, number>();

  weekRanges.forEach(week => {
    weeklyTotals.set(week.label, 0);
  });

  let grandTotal = 0;

  summaries.forEach(summary => {
    summary.weeklyTotals.forEach((quantity, weekLabel) => {
      const currentTotal = weeklyTotals.get(weekLabel) || 0;
      weeklyTotals.set(weekLabel, currentTotal + quantity);
    });
    grandTotal += summary.grandTotal;
  });

  return { weeklyTotals, grandTotal };
}

/**
 * Get the start of the current week (Sunday)
 */
export function getStartOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Adjust to Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format number with thousands separator
 */
export function formatQuantity(quantity: number): string {
  if (quantity === 0) return '';
  return quantity.toLocaleString();
}
