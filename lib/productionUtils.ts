import type { ParsedJob } from "@/hooks/useJobs";
import type { ProductionEntry, ProductionComparison } from "@/types";

/**
 * Calculate revenue from requirements.price_per_m if available, otherwise use total_billing
 */
function getJobRevenue(job: ParsedJob): number {
  // Check if job has parsed requirements with price_per_m
  if (
    job.requirements &&
    Array.isArray(job.requirements) &&
    job.requirements.length > 0
  ) {
    const revenue = job.requirements.reduce((total, req) => {
      const pricePerMStr = req.price_per_m;
      const isValidPrice =
        pricePerMStr && pricePerMStr !== "undefined" && pricePerMStr !== "null";
      const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
      return total + (job.quantity / 1000) * pricePerM;
    }, 0);

    // Add add-on charges if available
    const addOnCharges = parseFloat(job.add_on_charges || "0");
    return revenue + addOnCharges;
  }

  // Fallback to total_billing
  return parseFloat(job.total_billing || "0");
}

/**
 * Calculate variance between projected and actual quantities
 * @param projected - Projected quantity
 * @param actual - Actual quantity produced
 * @returns Object with variance amount and percentage
 */
export const calculateVariance = (
  projected: number,
  actual: number,
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
  endDate: number,
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
  entries: ProductionEntry[],
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
 * @param startDate - Optional start date filter (timestamp)
 * @param endDate - Optional end date filter (timestamp)
 * @returns Map of job IDs to { total quantity, entry IDs, last updated timestamp }
 */
export const aggregateProductionByJob = (
  entries: ProductionEntry[],
  startDate?: number,
  endDate?: number,
): Map<
  number,
  { total: number; entryIds: number[]; lastUpdatedAt?: number }
> => {
  const jobTotals = new Map<
    number,
    { total: number; entryIds: number[]; lastUpdatedAt?: number }
  >();

  entries.forEach((entry) => {
    // Filter by date range if provided
    if (startDate !== undefined && entry.date < startDate) {
      return; // Skip entries before start date
    }
    if (endDate !== undefined && entry.date > endDate) {
      return; // Skip entries after end date
    }

    const current = jobTotals.get(entry.job) || {
      total: 0,
      entryIds: [],
      lastUpdatedAt: undefined,
    };

    // Track the most recent created_at timestamp
    const newLastUpdated = current.lastUpdatedAt
      ? Math.max(current.lastUpdatedAt, entry.created_at)
      : entry.created_at;

    jobTotals.set(entry.job, {
      total: current.total + entry.actual_quantity,
      entryIds: [...current.entryIds, entry.id],
      lastUpdatedAt: newLastUpdated,
    });
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
  endDate: number,
): ProductionComparison[] => {
  // Filter jobs to those in the time range
  const relevantJobs = getJobsInTimeRange(jobs, startDate, endDate);

  // Helper to parse "DD.MM.YYYY" into a timestamp
  const parseDotDateToTimestamp = (dateStr: string): number | null => {
    const parts = dateStr.split(".");
    if (parts.length !== 3) return null;
    const [dayStr, monthStr, yearStr] = parts;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10) - 1; // JS months are 0-based
    const year = parseInt(yearStr, 10);
    if (
      Number.isNaN(day) ||
      Number.isNaN(month) ||
      Number.isNaN(year)
    ) {
      return null;
    }
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  // Aggregate actuals from legacy production entries (fallback)
  const actualByJobFromEntries = aggregateProductionByJob(
    productionEntries,
    startDate,
    endDate,
  );

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

    // Prefer actual_quantity array coming directly from jobs v2 API when available
    let actual_quantity = 0;
    let lastUpdatedAt: number | undefined = undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobAny: any = job;
    if (Array.isArray(jobAny.actual_quantity) && jobAny.actual_quantity.length > 0) {
      jobAny.actual_quantity.forEach((entry: any) => {
        if (!entry || typeof entry.date !== "string") return;
        const ts = parseDotDateToTimestamp(entry.date);
        if (ts === null) return;
        if (ts < startDate || ts > endDate) return;

        const qty = typeof entry.quantity === "number" ? entry.quantity : Number(entry.quantity) || 0;
        actual_quantity += qty;

        if (entry.date_entered) {
          const enteredTs = parseDotDateToTimestamp(entry.date_entered);
          if (enteredTs !== null) {
            lastUpdatedAt = lastUpdatedAt ? Math.max(lastUpdatedAt, enteredTs) : enteredTs;
          }
        }
      });
    } else {
      // Fallback to legacy production_entry table aggregation
      const jobData = actualByJobFromEntries.get(job.id) || {
        total: 0,
        entryIds: [],
        lastUpdatedAt: undefined,
      };
      actual_quantity = jobData.total;
      lastUpdatedAt = jobData.lastUpdatedAt;
    }


    // Calculate variance
    const { variance, variance_percentage } = calculateVariance(
      projected_quantity,
      actual_quantity,
    );

    return {
      job,
      projected_quantity,
      actual_quantity,
      variance,
      variance_percentage,
      entry_ids: [], // No discrete production_entry IDs when using jobs v2 actual_quantity
      last_updated_at: lastUpdatedAt,
    };
  });
};

/**
 * Get variance status for color-coding
 * @param variance_percentage - Variance as a percentage
 * @returns Status string for styling
 */
export const getVarianceStatus = (
  variance_percentage: number,
): "ahead" | "on-track" | "behind" => {
  if (variance_percentage >= -5) return "ahead"; // >= 95% of projected
  if (variance_percentage >= -20) return "on-track"; // 80-95% of projected
  return "behind"; // < 80% of projected
};

/**
 * Calculate summary statistics for production
 * @param comparisons - Array of production comparisons
 * @returns Summary object with key metrics
 */
export const calculateProductionSummary = (
  comparisons: ProductionComparison[],
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
  const total_projected = comparisons.reduce(
    (sum, c) => sum + c.projected_quantity,
    0,
  );
  const total_actual = comparisons.reduce(
    (sum, c) => sum + c.actual_quantity,
    0,
  );
  const total_variance = total_actual - total_projected;
  const average_variance_percentage =
    total_projected > 0 ? (total_variance / total_projected) * 100 : 0;

  let jobs_ahead = 0;
  let jobs_on_track = 0;
  let jobs_behind = 0;

  comparisons.forEach((c) => {
    const status = getVarianceStatus(c.variance_percentage);
    if (status === "ahead") jobs_ahead++;
    else if (status === "on-track") jobs_on_track++;
    else jobs_behind++;
  });

  const completion_rate =
    total_projected > 0 ? (total_actual / total_projected) * 100 : 0;

  // Calculate total revenue based on actual production
  const total_revenue = comparisons.reduce((sum, c) => {
    const jobTotalBilling = getJobRevenue(c.job);
    const jobQuantity = c.job.quantity || 0;

    if (jobQuantity === 0) return sum;

    // Calculate revenue proportional to actual quantity produced
    const revenueGenerated =
      (c.actual_quantity / jobQuantity) * jobTotalBilling;
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
