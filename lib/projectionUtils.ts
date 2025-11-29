import { ParsedJob } from "@/hooks/useJobs";
import { getDaysBetween, MonthRange, QuarterRange } from "./dateUtils";
import { normalizeProcessType } from "./processTypeConfig";

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

export interface ProcessTypeSummary {
  processType: string;
  weeklyTotals: Map<string, number>; // periodLabel -> total quantity
  weeklyRevenues: Map<string, number>; // periodLabel -> total revenue
  grandTotal: number;
  grandRevenue: number;
  jobCount: number;
}

export interface ProcessTypeFacilitySummary {
  processType: string;
  facilityId: number | null;
  facilityName: string;
  weeklyTotals: Map<string, number>; // periodLabel -> total quantity
  weeklyRevenues: Map<string, number>; // periodLabel -> total revenue
  grandTotal: number;
  grandRevenue: number;
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
  jobNumber: string;
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
 * Uses time_split data from v2 API when available, otherwise falls back to date-based calculation
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

  // Check if job has time_split data (from v2 API)
  const timeSplit = (job as any).time_split;
  if (timeSplit) {
    // Determine granularity from timeRanges
    const firstRange = timeRanges[0];
    const isWeekly = 'weekNumber' in firstRange;
    const isMonthly = 'monthNumber' in firstRange;
    const isQuarterly = 'quarter' in firstRange;

    if (isWeekly && timeSplit.weekly) {
      // Map weekly time_split to timeRanges
      timeRanges.forEach((range) => {
        const rangeStart = new Date(range.startDate);
        rangeStart.setHours(0, 0, 0, 0);
        const rangeStartStr = rangeStart.toISOString().split('T')[0]; // YYYY-MM-DD

        // Find matching week in time_split
        const matchingWeek = timeSplit.weekly.find((week: any) => {
          const weekStart = new Date(week.week_start);
          weekStart.setHours(0, 0, 0, 0);
          const weekStartStr = weekStart.toISOString().split('T')[0];
          
          // Exact match on week start date
          return weekStartStr === rangeStartStr;
        });

        if (matchingWeek) {
          quantities.set(range.label, matchingWeek.quantity || 0);
        }
      });
    } else if (isMonthly && timeSplit.monthly) {
      // Map monthly time_split to timeRanges
      timeRanges.forEach((range) => {
        const rangeStart = range.startDate;
        const rangeYear = rangeStart.getFullYear();
        const rangeMonth = rangeStart.getMonth() + 1; // 1-12

        // Find matching month in time_split
        const matchingMonth = timeSplit.monthly.find((month: any) => {
          const monthStart = new Date(month.month_start);
          return (
            monthStart.getFullYear() === rangeYear &&
            monthStart.getMonth() + 1 === rangeMonth
          );
        });

        if (matchingMonth) {
          quantities.set(range.label, matchingMonth.quantity || 0);
        }
      });
    } else if (isQuarterly && timeSplit.quarterly) {
      // Map quarterly time_split to timeRanges
      timeRanges.forEach((range) => {
        const rangeStart = range.startDate;
        const rangeYear = rangeStart.getFullYear();
        const rangeQuarter = Math.floor(rangeStart.getMonth() / 3) + 1; // 1-4

        // Find matching quarter in time_split
        const matchingQuarter = timeSplit.quarterly.find((quarter: any) => {
          return quarter.year === rangeYear && quarter.quarter === rangeQuarter;
        });

        if (matchingQuarter) {
          quantities.set(range.label, matchingQuarter.quantity || 0);
        }
      });
    }

    // If we found any quantities from time_split, return them
    const hasQuantities = Array.from(quantities.values()).some(qty => qty > 0);
    if (hasQuantities) {
      return quantities;
    }
  }

  // Fallback to date-based calculation if no time_split or no matches found
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

/**
 * Aggregate projections by process type to create summary rows
 * Similar to service type summaries, but aggregates by the process types from job requirements
 */
export function calculateProcessTypeSummaries(
  jobProjections: JobProjection[],
  timeRanges: TimeRange[],
): ProcessTypeSummary[] {
  const summaryMap = new Map<string, ProcessTypeSummary>();
  // Track canonical display names (first occurrence's casing)
  const canonicalNames = new Map<string, string>();

  jobProjections.forEach((projection) => {
    const job = projection.job;
    const numProcesses = job.requirements?.length || 0;

    // Skip jobs with no processes
    if (numProcesses === 0) {
      return;
    }

    // Process each requirement
    job.requirements.forEach((requirement) => {
      const processType = requirement.process_type || "Unknown";
      // Normalize to lowercase for grouping (case-insensitive)
      const normalizedKey = processType.toLowerCase();

      // Store canonical name (first occurrence's casing)
      if (!canonicalNames.has(normalizedKey)) {
        canonicalNames.set(normalizedKey, processType);
      }

      // Initialize summary for this process type if not exists
      if (!summaryMap.has(normalizedKey)) {
        const weeklyTotals = new Map<string, number>();
        const weeklyRevenues = new Map<string, number>();
        timeRanges.forEach((range) => {
          weeklyTotals.set(range.label, 0);
          weeklyRevenues.set(range.label, 0);
        });

        summaryMap.set(normalizedKey, {
          processType: canonicalNames.get(normalizedKey) || processType,
          weeklyTotals,
          weeklyRevenues,
          grandTotal: 0,
          grandRevenue: 0,
          jobCount: 0,
        });
      }

      const summary = summaryMap.get(normalizedKey)!;

      // For each time period, add the job's quantity for this process
      // Quantities are distributed equally among all processes in the job
      projection.weeklyQuantities.forEach((quantity, label) => {
        const processQty = Math.round(quantity / numProcesses);
        const currentTotal = summary.weeklyTotals.get(label) || 0;
        summary.weeklyTotals.set(label, currentTotal + processQty);
      });

      // For revenue, calculate based on this specific process's price_per_m
      const processRevenue = getProcessRevenue(job, requirement);
      projection.weeklyRevenues.forEach((jobRevenue, label) => {
        const processRev = jobRevenue / numProcesses;
        const currentRevTotal = summary.weeklyRevenues.get(label) || 0;
        summary.weeklyRevenues.set(label, currentRevTotal + processRev);
      });

      // Update grand totals
      const totalProcessQuantity = Math.round(projection.totalQuantity / numProcesses);
      summary.grandTotal += totalProcessQuantity;
      summary.grandRevenue += processRevenue;
    });
  });

  // Update job counts - count unique jobs per process type
  jobProjections.forEach((projection) => {
    const job = projection.job;
    if (!job.requirements || job.requirements.length === 0) {
      return;
    }

    // Track which process types this job has (normalized keys)
    const processTypesInJob = new Set<string>();
    job.requirements.forEach((req) => {
      const processType = req.process_type || "Unknown";
      processTypesInJob.add(processType.toLowerCase());
    });

    // Increment job count for each process type in this job
    processTypesInJob.forEach((normalizedKey) => {
      const summary = summaryMap.get(normalizedKey);
      if (summary) {
        summary.jobCount++;
      }
    });
  });

  // Convert to array and sort by process type name
  return Array.from(summaryMap.values()).sort((a, b) =>
    a.processType.localeCompare(b.processType),
  );
}

/**
 * Calculate breakdown of a specific process type by a dynamic field value
 * Used to show expandable sub-rows under process type summaries
 *
 * @param jobProjections - All job projections (already filtered)
 * @param timeRanges - Time periods to calculate quantities for
 * @param processType - The process type to break down (e.g., "insert", "laser")
 * @param fieldName - The dynamic field to group by (e.g., "paper_size", "basic_oe")
 * @returns Array of breakdowns, one per unique field value
 */
export function calculateProcessTypeBreakdownByField(
  jobProjections: JobProjection[],
  timeRanges: TimeRange[],
  processType: string,
  fieldName: string,
): import("@/types").ProcessTypeBreakdown[] {
  const normalizedProcessType = processType.toLowerCase();
  const breakdownMap = new Map<any, import("@/types").ProcessTypeBreakdown>();

  // Track jobs that have been counted for this breakdown (to avoid double-counting)
  const jobsCountedPerValue = new Map<any, Set<number>>();

  console.log(`[calculateProcessTypeBreakdownByField] Looking for processType="${normalizedProcessType}", field="${fieldName}", in ${jobProjections.length} projections`);

  let matchedRequirements = 0;
  let skippedEmptyFields = 0;
  const foundProcessTypes = new Set<string>();

  jobProjections.forEach((projection) => {
    const job = projection.job;
    const numProcesses = job.requirements?.length || 0;

    if (numProcesses === 0) {
      return;
    }

    // Process each requirement
    job.requirements.forEach((requirement) => {
      const rawProcessType = requirement.process_type || "Unknown";
      const reqProcessType = normalizeProcessType(rawProcessType).toLowerCase();
      foundProcessTypes.add(`${rawProcessType} -> ${reqProcessType}`);

      // Only process requirements matching the target process type
      if (reqProcessType !== normalizedProcessType) {
        return;
      }

      matchedRequirements++;

      // Get the field value for this requirement
      const fieldValue = requirement[fieldName];

      // Skip if field value is undefined, null, or empty string
      if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
        skippedEmptyFields++;
        console.log(`[calculateProcessTypeBreakdownByField] Job ${job.job_number}: field "${fieldName}" is empty/undefined. Requirement:`, requirement);
        return;
      }

      // Initialize breakdown for this field value if not exists
      if (!breakdownMap.has(fieldValue)) {
        const quantities: { [timeRangeKey: string]: number } = {};
        timeRanges.forEach((range) => {
          quantities[range.label] = 0;
        });

        // Generate a display label for the field value
        let fieldLabel: string;
        if (typeof fieldValue === "boolean") {
          fieldLabel = fieldValue ? "Yes" : "No";
        } else {
          fieldLabel = String(fieldValue);
        }

        breakdownMap.set(fieldValue, {
          processType: normalizedProcessType,
          fieldName,
          fieldValue,
          fieldLabel,
          quantities,
          totalQuantity: 0,
          jobCount: 0,
        });

        // Initialize job tracking set for this value
        jobsCountedPerValue.set(fieldValue, new Set<number>());
      }

      const breakdown = breakdownMap.get(fieldValue)!;

      // Add quantities for each time period
      // Quantities are distributed equally among all processes in the job
      projection.weeklyQuantities.forEach((quantity, label) => {
        const processQty = Math.round(quantity / numProcesses);
        breakdown.quantities[label] = (breakdown.quantities[label] || 0) + processQty;
      });

      // Update total quantity
      const totalProcessQuantity = Math.round(projection.totalQuantity / numProcesses);
      breakdown.totalQuantity += totalProcessQuantity;

      // Track unique jobs for job count
      const jobsSet = jobsCountedPerValue.get(fieldValue)!;
      if (!jobsSet.has(job.id)) {
        jobsSet.add(job.id);
        breakdown.jobCount++;
      }
    });
  });

  console.log(`[calculateProcessTypeBreakdownByField] Summary: matched ${matchedRequirements} requirements, skipped ${skippedEmptyFields} with empty field, found ${breakdownMap.size} unique values`);
  console.log(`[calculateProcessTypeBreakdownByField] Process types found in requirements:`, Array.from(foundProcessTypes));

  // Convert to array and sort by field value
  const result = Array.from(breakdownMap.values()).sort((a, b) => {
    // Sort booleans with true first
    if (typeof a.fieldValue === "boolean" && typeof b.fieldValue === "boolean") {
      return a.fieldValue === b.fieldValue ? 0 : a.fieldValue ? -1 : 1;
    }
    // Sort numbers numerically
    if (typeof a.fieldValue === "number" && typeof b.fieldValue === "number") {
      return a.fieldValue - b.fieldValue;
    }
    // Sort strings alphabetically
    return String(a.fieldValue).localeCompare(String(b.fieldValue));
  });

  console.log(`[calculateProcessTypeBreakdownByField] Returning ${result.length} breakdown entries`);
  return result;
}

/**
 * Aggregate projections by process type AND facility to create facility-specific summary rows
 * Similar to calculateProcessTypeSummaries but groups by both process type and facility
 */
export function calculateProcessTypeSummariesByFacility(
  jobProjections: JobProjection[],
  timeRanges: TimeRange[],
): ProcessTypeFacilitySummary[] {
  const summaryMap = new Map<string, ProcessTypeFacilitySummary>();
  // Track canonical display names (first occurrence's casing)
  const canonicalNames = new Map<string, string>();

  // Facility ID to name mapping
  const facilityNames: { [key: number]: string } = {
    1: "Bolingbrook",
    2: "Lemont",
  };

  jobProjections.forEach((projection) => {
    const job = projection.job;
    const numProcesses = job.requirements?.length || 0;

    // Skip jobs with no processes
    if (numProcesses === 0) {
      return;
    }

    // Get facility info
    const facilityId = job.facilities_id || null;
    const facilityName = facilityId ? facilityNames[facilityId] || "Unknown" : "No Facility";

    // Process each requirement
    job.requirements.forEach((requirement) => {
      const processType = requirement.process_type || "Unknown";
      // Normalize to lowercase for grouping (case-insensitive)
      const normalizedKey = processType.toLowerCase();

      // Store canonical name (first occurrence's casing)
      if (!canonicalNames.has(normalizedKey)) {
        canonicalNames.set(normalizedKey, processType);
      }

      // Create composite key: normalizedProcessType-facilityId
      const compositeKey = `${normalizedKey}-${facilityId}`;

      // Initialize summary for this process type + facility combo if not exists
      if (!summaryMap.has(compositeKey)) {
        const weeklyTotals = new Map<string, number>();
        const weeklyRevenues = new Map<string, number>();
        timeRanges.forEach((range) => {
          weeklyTotals.set(range.label, 0);
          weeklyRevenues.set(range.label, 0);
        });

        summaryMap.set(compositeKey, {
          processType: canonicalNames.get(normalizedKey) || processType,
          facilityId,
          facilityName,
          weeklyTotals,
          weeklyRevenues,
          grandTotal: 0,
          grandRevenue: 0,
          jobCount: 0,
        });
      }

      const summary = summaryMap.get(compositeKey)!;

      // For each time period, add the job's quantity for this process
      // Quantities are distributed equally among all processes in the job
      projection.weeklyQuantities.forEach((quantity, label) => {
        const processQty = Math.round(quantity / numProcesses);
        const currentTotal = summary.weeklyTotals.get(label) || 0;
        summary.weeklyTotals.set(label, currentTotal + processQty);
      });

      // For revenue, calculate based on this specific process's price_per_m
      const processRevenue = getProcessRevenue(job, requirement);
      projection.weeklyRevenues.forEach((jobRevenue, label) => {
        const processRev = jobRevenue / numProcesses;
        const currentRevTotal = summary.weeklyRevenues.get(label) || 0;
        summary.weeklyRevenues.set(label, currentRevTotal + processRev);
      });

      // Update grand totals
      const totalProcessQuantity = Math.round(projection.totalQuantity / numProcesses);
      summary.grandTotal += totalProcessQuantity;
      summary.grandRevenue += processRevenue;
    });
  });

  // Update job counts - count unique jobs per process type + facility combination
  jobProjections.forEach((projection) => {
    const job = projection.job;
    if (!job.requirements || job.requirements.length === 0) {
      return;
    }

    const facilityId = job.facilities_id || null;

    // Track which process types this job has (normalized keys)
    const processTypesInJob = new Set<string>();
    job.requirements.forEach((req) => {
      const processType = req.process_type || "Unknown";
      processTypesInJob.add(processType.toLowerCase());
    });

    // Increment job count for each process type + facility combo in this job
    processTypesInJob.forEach((normalizedKey) => {
      const compositeKey = `${normalizedKey}-${facilityId}`;
      const summary = summaryMap.get(compositeKey);
      if (summary) {
        summary.jobCount++;
      }
    });
  });

  // Convert to array and sort by process type, then by facility name
  return Array.from(summaryMap.values()).sort((a, b) => {
    const processCompare = a.processType.localeCompare(b.processType);
    if (processCompare !== 0) return processCompare;
    return a.facilityName.localeCompare(b.facilityName);
  });
}
