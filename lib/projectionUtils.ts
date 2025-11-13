import { ParsedJob } from "@/hooks/useJobs";
import { getDaysBetween, MonthRange, QuarterRange } from "./dateUtils";

export interface WeekRange {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  label: string; // e.g., "8/25", "9/1"
}

// Generic time period range that can be week, month, or quarter
export type TimeRange = WeekRange | MonthRange | QuarterRange;

export interface JobProjection {
  job: ParsedJob;
  weeklyQuantities: Map<string, number>; // weekLabel -> quantity (kept for backwards compatibility, but will hold any period)
  weeklyRevenues: Map<string, number>; // weekLabel -> revenue
  totalQuantity: number;
  totalRevenue: number;
}

export interface ServiceTypeSummary {
  serviceType: string;
  weeklyTotals: Map<string, number>; // weekLabel -> total quantity (kept for backwards compatibility, but will hold any period)
  grandTotal: number;
  jobCount: number;
}

export interface ProcessProjection {
  job: ParsedJob;
  processType: string;
  requirement: any; // JobRequirement type
  weeklyQuantities: Map<string, number>; // Per-process quantities
  weeklyRevenues: Map<string, number>; // Per-process revenues
  totalQuantity: number;
  totalRevenue: number;
  jobId: number;
  jobNumber: number;
}

/**
 * Calculate revenue from requirements.price_per_m if available, otherwise use total_billing
 */
export function getJobRevenue(job: ParsedJob): number {
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
 * Generate 6 consecutive week ranges starting from a given date
 */
export function generateWeekRanges(startDate: Date): WeekRange[] {
  const weeks: WeekRange[] = [];
  const baseDate = new Date(startDate);

  // Normalize to start of day
  baseDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < 6; i++) {
    const weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() + i * 7);

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
  weekRanges: WeekRange[],
): Map<string, number> {
  const weeklyQuantities = new Map<string, number>();

  // Initialize all weeks to 0
  weekRanges.forEach((week) => {
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
  weekRanges.forEach((week) => {
    let daysInWeek = 0;

    jobDays.forEach((day) => {
      const dayTime = day.getTime();
      if (
        dayTime >= week.startDate.getTime() &&
        dayTime <= week.endDate.getTime()
      ) {
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
  weekRanges: WeekRange[],
): JobProjection[] {
  return jobs.map((job) => {
    const weeklyQuantities = calculateJobWeeklyDistribution(job, weekRanges);

    // Calculate total from weekly quantities (may differ slightly from job.quantity due to rounding)
    let totalQuantity = 0;
    weeklyQuantities.forEach((qty) => {
      totalQuantity += qty;
    });

    // Calculate revenue per period
    const jobRevenue = getJobRevenue(job);
    const weeklyRevenues = new Map<string, number>();
    let totalRevenue = 0;

    // Revenue is proportional to quantity in each period
    if (job.quantity > 0) {
      weeklyQuantities.forEach((quantity, label) => {
        const periodRevenue = (quantity / job.quantity) * jobRevenue;
        weeklyRevenues.set(label, periodRevenue);
        totalRevenue += periodRevenue;
      });
    } else {
      // If no quantity, set all revenues to 0
      weekRanges.forEach((range) => {
        weeklyRevenues.set(range.label, 0);
      });
    }

    return {
      job,
      weeklyQuantities,
      weeklyRevenues,
      totalQuantity,
      totalRevenue,
    };
  });
}

/**
 * Aggregate projections by service type to create summary rows
 */
export function calculateServiceTypeSummaries(
  jobProjections: JobProjection[],
  weekRanges: WeekRange[],
): ServiceTypeSummary[] {
  const summaryMap = new Map<string, ServiceTypeSummary>();

  jobProjections.forEach((projection) => {
    const serviceType = projection.job.service_type || "Unknown";

    if (!summaryMap.has(serviceType)) {
      const weeklyTotals = new Map<string, number>();
      weekRanges.forEach((week) => {
        weeklyTotals.set(week.label, 0);
      });

      summaryMap.set(serviceType, {
        serviceType,
        weeklyTotals,
        grandTotal: 0,
        jobCount: 0,
      });
    }

    const summary = summaryMap.get(serviceType)!;

    // Add this job's weekly quantities to the service type totals
    projection.weeklyQuantities.forEach((quantity, weekLabel) => {
      const currentTotal = summary.weeklyTotals.get(weekLabel) || 0;
      summary.weeklyTotals.set(weekLabel, currentTotal + quantity);
    });

    summary.grandTotal += projection.totalQuantity;
    summary.jobCount++;
  });

  // Convert to array and sort by service type name
  return Array.from(summaryMap.values()).sort((a, b) =>
    a.serviceType.localeCompare(b.serviceType),
  );
}

/**
 * Calculate grand totals across all service types
 */
export function calculateGrandTotals(
  summaries: ServiceTypeSummary[],
  weekRanges: WeekRange[],
): { weeklyTotals: Map<string, number>; grandTotal: number } {
  const weeklyTotals = new Map<string, number>();

  weekRanges.forEach((week) => {
    weeklyTotals.set(week.label, 0);
  });

  let grandTotal = 0;

  summaries.forEach((summary) => {
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
  if (quantity === 0) return "";
  return quantity.toLocaleString();
}

/**
 * Generic function to calculate job distribution across any time periods (weeks, months, quarters)
 */
export function calculateJobDistribution(
  job: ParsedJob,
  timeRanges: TimeRange[],
): Map<string, number> {
  const quantities = new Map<string, number>();

  // Initialize all periods to 0
  timeRanges.forEach((range) => {
    quantities.set(range.label, 0);
  });

  // If job has no dates or quantity, return zeros
  if (!job.start_date || !job.due_date || !job.quantity) {
    return quantities;
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
    return quantities;
  }

  // Calculate daily quantity
  const dailyQuantity = job.quantity / totalJobDays;

  // For each time period, count how many job days fall within it
  timeRanges.forEach((range) => {
    let daysInPeriod = 0;

    jobDays.forEach((day) => {
      const dayTime = day.getTime();
      if (
        dayTime >= range.startDate.getTime() &&
        dayTime <= range.endDate.getTime()
      ) {
        daysInPeriod++;
      }
    });

    const periodQuantity = Math.round(dailyQuantity * daysInPeriod);
    quantities.set(range.label, periodQuantity);
  });

  return quantities;
}

/**
 * Calculate projections for all jobs using generic time ranges
 */
export function calculateGenericJobProjections(
  jobs: ParsedJob[],
  timeRanges: TimeRange[],
): JobProjection[] {
  return jobs.map((job) => {
    const weeklyQuantities = calculateJobDistribution(job, timeRanges);

    // Calculate total from quantities (may differ slightly from job.quantity due to rounding)
    let totalQuantity = 0;
    weeklyQuantities.forEach((qty) => {
      totalQuantity += qty;
    });

    // Calculate revenue per period
    const jobRevenue = getJobRevenue(job);
    const weeklyRevenues = new Map<string, number>();
    let totalRevenue = 0;

    // Revenue is proportional to quantity in each period
    if (job.quantity > 0) {
      weeklyQuantities.forEach((quantity, label) => {
        const periodRevenue = (quantity / job.quantity) * jobRevenue;
        weeklyRevenues.set(label, periodRevenue);
        totalRevenue += periodRevenue;
      });
    } else {
      // If no quantity, set all revenues to 0
      timeRanges.forEach((range) => {
        weeklyRevenues.set(range.label, 0);
      });
    }

    return {
      job,
      weeklyQuantities,
      weeklyRevenues,
      totalQuantity,
      totalRevenue,
    };
  });
}

/**
 * Aggregate projections by service type using generic time ranges
 */
export function calculateGenericServiceTypeSummaries(
  jobProjections: JobProjection[],
  timeRanges: TimeRange[],
): ServiceTypeSummary[] {
  const summaryMap = new Map<string, ServiceTypeSummary>();

  jobProjections.forEach((projection) => {
    const serviceType = projection.job.service_type || "Unknown";

    if (!summaryMap.has(serviceType)) {
      const weeklyTotals = new Map<string, number>();
      timeRanges.forEach((range) => {
        weeklyTotals.set(range.label, 0);
      });

      summaryMap.set(serviceType, {
        serviceType,
        weeklyTotals,
        grandTotal: 0,
        jobCount: 0,
      });
    }

    const summary = summaryMap.get(serviceType)!;

    // Add this job's quantities to the service type totals
    projection.weeklyQuantities.forEach((quantity, label) => {
      const currentTotal = summary.weeklyTotals.get(label) || 0;
      summary.weeklyTotals.set(label, currentTotal + quantity);
    });

    summary.grandTotal += projection.totalQuantity;
    summary.jobCount++;
  });

  // Convert to array and sort by service type name
  return Array.from(summaryMap.values()).sort((a, b) =>
    a.serviceType.localeCompare(b.serviceType),
  );
}

/**
 * Calculate grand totals across all service types using generic time ranges
 */
export function calculateGenericGrandTotals(
  summaries: ServiceTypeSummary[],
  timeRanges: TimeRange[],
): { weeklyTotals: Map<string, number>; grandTotal: number } {
  const weeklyTotals = new Map<string, number>();

  timeRanges.forEach((range) => {
    weeklyTotals.set(range.label, 0);
  });

  let grandTotal = 0;

  summaries.forEach((summary) => {
    summary.weeklyTotals.forEach((quantity, label) => {
      const currentTotal = weeklyTotals.get(label) || 0;
      weeklyTotals.set(label, currentTotal + quantity);
    });
    grandTotal += summary.grandTotal;
  });

  return { weeklyTotals, grandTotal };
}

/**
 * Calculate revenue for a single process requirement
 */
export function getProcessRevenue(job: ParsedJob, requirement: any): number {
  const pricePerMStr = requirement.price_per_m;
  const isValidPrice =
    pricePerMStr && pricePerMStr !== "undefined" && pricePerMStr !== "null";
  const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
  return (job.quantity / 1000) * pricePerM;
}

/**
 * Expand job projections into per-process projections
 * Each job with multiple processes becomes multiple rows
 */
export function expandJobProjectionsToProcesses(
  jobProjections: JobProjection[],
): ProcessProjection[] {
  const processProjections: ProcessProjection[] = [];

  jobProjections.forEach((projection) => {
    const job = projection.job;
    const numProcesses = job.requirements?.length || 0;

    // Skip jobs with no processes
    if (numProcesses === 0) {
      return;
    }

    // Create a projection for each process
    job.requirements.forEach((requirement) => {
      const processQuantities = new Map<string, number>();
      const processRevenues = new Map<string, number>();
      let totalProcessQuantity = 0;

      // Calculate per-process quantities (equal distribution)
      projection.weeklyQuantities.forEach((quantity, label) => {
        const processQty = Math.round(quantity / numProcesses);
        processQuantities.set(label, processQty);
        totalProcessQuantity += processQty;
      });

      // Calculate per-process revenue
      const processRevenue = getProcessRevenue(job, requirement);
      let totalProcessRevenue = 0;

      // Distribute revenue proportionally to quantity
      projection.weeklyRevenues.forEach((revenue, label) => {
        const processRev = revenue / numProcesses;
        processRevenues.set(label, processRev);
        totalProcessRevenue += processRev;
      });

      processProjections.push({
        job,
        processType: requirement.process_type || "Unknown",
        requirement,
        weeklyQuantities: processQuantities,
        weeklyRevenues: processRevenues,
        totalQuantity: totalProcessQuantity,
        totalRevenue: totalProcessRevenue,
        jobId: job.id,
        jobNumber: job.job_number,
      });
    });
  });

  return processProjections;
}
