import type { ParsedJob } from '@/hooks/useJobs';
import type { ProductionEntry, ProductionComparison } from '@/types';

/**
 * Calculate variance between projected and actual quantities
 * @param projected - Projected quantity
 * @param actual - Actual quantity produced
 * @returns Object with variance amount and percentage
 */
export const calculateVariance = (
  projected: number,
  actual: number
): { variance: number; variance_percentage: number } => {
  const variance = actual - projected;
  const variance_percentage = projected > 0 ? (variance / projected) * 100 : 0;

  return {
    variance,
    variance_percentage,
  };
};

/**
 * Filter jobs that are active within a given time range
 * @param jobs - Array of parsed jobs
 * @param startDate - Start of time range (timestamp)
 * @param endDate - End of time range (timestamp)
 * @returns Jobs that overlap with the time range
 */
export const getJobsInTimeRange = (
  jobs: ParsedJob[],
  startDate: number,
  endDate: number
): ParsedJob[] => {
  return jobs.filter((job) => {
    // Job is in range if:
    // - It starts before the end of the range AND
    // - It ends after the start of the range
    return job.start_date <= endDate && job.due_date >= startDate;
  });
};

/**
 * Aggregate daily production entries into weekly totals
 * @param entries - Array of production entries
 * @returns Map of week start timestamps to total quantities
 */
export const aggregateProductionByWeek = (
  entries: ProductionEntry[]
): Map<number, number> => {
  const weeklyTotals = new Map<number, number>();

  entries.forEach((entry) => {
    // Get the start of the week (Monday) for this entry
    const date = new Date(entry.date);
    const dayOfWeek = date.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust when day is Sunday (0)
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.getTime();

    // Add to weekly total
    const currentTotal = weeklyTotals.get(weekStart) || 0;
    weeklyTotals.set(weekStart, currentTotal + entry.actual_quantity);
  });

  return weeklyTotals;
};

/**
 * Aggregate production entries by job
 * @param entries - Array of production entries
 * @returns Map of job IDs to total quantities
 */
export const aggregateProductionByJob = (
  entries: ProductionEntry[]
): Map<number, number> => {
  const jobTotals = new Map<number, number>();

  entries.forEach((entry) => {
    const currentTotal = jobTotals.get(entry.job) || 0;
    jobTotals.set(entry.job, currentTotal + entry.actual_quantity);
  });

  return jobTotals;
};

/**
 * Merge projected quantities with actual production data to create comparisons
 * @param jobs - Array of parsed jobs
 * @param productionEntries - Array of production entries
 * @param startDate - Start of time range for projection calculation
 * @param endDate - End of time range for projection calculation
 * @returns Array of production comparisons
 */
export const mergeProjectionsWithActuals = (
  jobs: ParsedJob[],
  productionEntries: ProductionEntry[],
  startDate: number,
  endDate: number
): ProductionComparison[] => {
  // Aggregate actual production by job
  const actualByJob = aggregateProductionByJob(productionEntries);

  // Filter jobs to those in the time range
  const relevantJobs = getJobsInTimeRange(jobs, startDate, endDate);

  // Create comparison for each job
  return relevantJobs.map((job) => {
    // Calculate projected quantity for this time period
    const totalDuration = job.due_date - job.start_date;
    const periodStart = Math.max(job.start_date, startDate);
    const periodEnd = Math.min(job.due_date, endDate);
    const periodDuration = periodEnd - periodStart;

    // Proportional projection based on overlap
    const projected_quantity =
      totalDuration > 0
        ? Math.round((job.quantity * periodDuration) / totalDuration)
        : job.quantity;

    // Get actual quantity from production entries
    const actual_quantity = actualByJob.get(job.id) || 0;

    // Calculate variance
    const { variance, variance_percentage } = calculateVariance(
      projected_quantity,
      actual_quantity
    );

    return {
      job,
      projected_quantity,
      actual_quantity,
      variance,
      variance_percentage,
    };
  });
};

/**
 * Get variance status for color-coding
 * @param variance_percentage - Variance as a percentage
 * @returns Status string for styling
 */
export const getVarianceStatus = (
  variance_percentage: number
): 'ahead' | 'on-track' | 'behind' => {
  if (variance_percentage >= -5) return 'ahead'; // >= 95% of projected
  if (variance_percentage >= -20) return 'on-track'; // 80-95% of projected
  return 'behind'; // < 80% of projected
};

/**
 * Calculate summary statistics for production
 * @param comparisons - Array of production comparisons
 * @returns Summary object with key metrics
 */
export const calculateProductionSummary = (
  comparisons: ProductionComparison[]
): {
  total_jobs: number;
  total_projected: number;
  total_actual: number;
  total_variance: number;
  average_variance_percentage: number;
  jobs_ahead: number;
  jobs_on_track: number;
  jobs_behind: number;
  completion_rate: number;
  total_revenue: number;
} => {
  const total_jobs = comparisons.length;
  const total_projected = comparisons.reduce((sum, c) => sum + c.projected_quantity, 0);
  const total_actual = comparisons.reduce((sum, c) => sum + c.actual_quantity, 0);
  const total_variance = total_actual - total_projected;
  const average_variance_percentage =
    total_projected > 0 ? (total_variance / total_projected) * 100 : 0;

  let jobs_ahead = 0;
  let jobs_on_track = 0;
  let jobs_behind = 0;

  comparisons.forEach((c) => {
    const status = getVarianceStatus(c.variance_percentage);
    if (status === 'ahead') jobs_ahead++;
    else if (status === 'on-track') jobs_on_track++;
    else jobs_behind++;
  });

  const completion_rate = total_projected > 0 ? (total_actual / total_projected) * 100 : 0;

  // Calculate total revenue based on actual production
  const total_revenue = comparisons.reduce((sum, c) => {
    const jobTotalBilling = parseFloat(c.job.total_billing || '0');
    const jobQuantity = c.job.quantity || 0;

    if (jobQuantity === 0) return sum;

    // Calculate revenue proportional to actual quantity produced
    const revenueGenerated = (c.actual_quantity / jobQuantity) * jobTotalBilling;
    return sum + revenueGenerated;
  }, 0);

  return {
    total_jobs,
    total_projected,
    total_actual,
    total_variance,
    average_variance_percentage,
    jobs_ahead,
    jobs_on_track,
    jobs_behind,
    completion_rate,
    total_revenue,
  };
};
