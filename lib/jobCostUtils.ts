/**
 * Utilities for job cost analysis and profit margin calculations
 * Handles comparison between billing rates (price_per_m) and actual costs
 */

import { ParsedJob } from "@/hooks/useJobs";

// ============================================================================
// Types
// ============================================================================

/**
 * Job cost entry tracking actual costs per thousand
 */
export interface JobCostEntry {
  id: number;
  job: number; // Foreign key to jobs table
  date: number; // Timestamp for the period
  actual_cost_per_m: number; // Actual cost per thousand
  notes?: string;
  created_at: number;
  updated_at: number;
  facilities_id?: number;
}

/**
 * Profit metrics for a job
 */
export interface JobProfitMetrics {
  billing_rate_per_m: number; // What client is charged (from requirements)
  actual_cost_per_m: number; // What it actually costs us
  profit_per_m: number; // billing_rate - actual_cost
  profit_percentage: number; // (profit / billing_rate) * 100
  total_profit: number; // (quantity / 1000) * profit_per_m
  profit_status: "excellent" | "good" | "warning" | "loss"; // Color coding
}

/**
 * Job with cost comparison data
 */
export interface JobCostComparison {
  job: ParsedJob;
  billing_rate_per_m: number;
  actual_cost_per_m: number | null; // null if no cost entry exists
  profit_metrics: JobProfitMetrics | null; // null if no cost data
  entry_ids: number[]; // Cost entry IDs for this job in the period
  last_updated_at?: number; // Most recent cost entry timestamp
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate weighted average cost per M from job requirements
 * Used to initialize job_cost_entry records when jobs are created/edited
 *
 * @param requirements - Array of job requirements with price_per_m fields
 * @returns Average price_per_m across all requirements, or 0 if none exist
 */
export function calculateAverageCostFromRequirements(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requirements: any[],
): number {
  if (!requirements || requirements.length === 0) {
    return 0;
  }

  // Filter requirements that have valid price_per_m values
  const validPrices = requirements
    .map((req) => {
      const priceStr = req.price_per_m;
      // Handle "undefined" string, null, undefined, and empty string
      const isValid =
        priceStr &&
        priceStr !== "undefined" &&
        priceStr !== "null" &&
        priceStr !== "";
      return isValid ? parseFloat(priceStr) : 0;
    })
    .filter((price) => price > 0);

  if (validPrices.length === 0) {
    return 0;
  }

  // Calculate average (simple average - all requirements weighted equally)
  const sum = validPrices.reduce((total, price) => total + price, 0);
  return sum / validPrices.length;
}

/**
 * Calculate billing rate per thousand from requirements.price_per_m
 * This reflects the sum of all price_per_m values from job requirements
 */
export function calculateBillingRatePerM(job: ParsedJob): number {
  // Sum up all price_per_m values from requirements
  if (!job.requirements || job.requirements.length === 0) {
    return 0;
  }

  const totalPricePerM = job.requirements.reduce((total, req) => {
    // Handle "undefined" string, null, undefined, and empty string
    const pricePerMStr = req.price_per_m;
    const isValidPrice =
      pricePerMStr && pricePerMStr !== "undefined" && pricePerMStr !== "null";
    const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
    return total + pricePerM;
  }, 0);

  return totalPricePerM;
}

/**
 * Calculate profit margin between billing rate and actual cost
 */
export function calculateProfitMargin(
  billingRate: number,
  actualCost: number,
): number {
  return billingRate - actualCost;
}

/**
 * Calculate profit percentage
 */
export function calculateProfitPercentage(
  billingRate: number,
  actualCost: number,
): number {
  if (billingRate === 0) return 0;
  const profit = calculateProfitMargin(billingRate, actualCost);
  return (profit / billingRate) * 100;
}

/**
 * Calculate total profit for a job based on quantity
 */
export function calculateTotalProfit(
  quantity: number,
  profitPerM: number,
): number {
  return (quantity / 1000) * profitPerM;
}

/**
 * Determine profit status for color coding
 */
export function getProfitStatus(
  profitPercentage: number,
): "excellent" | "good" | "warning" | "loss" {
  if (profitPercentage < 0) return "loss";
  if (profitPercentage < 10) return "warning";
  if (profitPercentage < 25) return "good";
  return "excellent";
}

/**
 * Calculate complete profit metrics for a job
 */
export function calculateJobProfitMetrics(
  job: ParsedJob,
  actualCostPerM: number,
): JobProfitMetrics {
  const billingRate = calculateBillingRatePerM(job);
  const profitPerM = calculateProfitMargin(billingRate, actualCostPerM);
  const profitPercentage = calculateProfitPercentage(
    billingRate,
    actualCostPerM,
  );
  const totalProfit = calculateTotalProfit(job.quantity, profitPerM);
  const profitStatus = getProfitStatus(profitPercentage);

  return {
    billing_rate_per_m: billingRate,
    actual_cost_per_m: actualCostPerM,
    profit_per_m: profitPerM,
    profit_percentage: profitPercentage,
    total_profit: totalProfit,
    profit_status: profitStatus,
  };
}

// ============================================================================
// Data Merging Functions
// ============================================================================

/**
 * Merge jobs with their cost entries for a given date range
 * Similar to mergeProjectionsWithActuals from productionUtils
 */
export function mergeJobsWithCostEntries(
  jobs: ParsedJob[],
  costEntries: JobCostEntry[],
  startDate: number,
  endDate: number,
): JobCostComparison[] {
  // Group cost entries by job ID
  const entriesByJob = new Map<number, JobCostEntry[]>();

  costEntries.forEach((entry) => {
    if (entry.date >= startDate && entry.date <= endDate) {
      const entries = entriesByJob.get(entry.job) || [];
      entries.push(entry);
      entriesByJob.set(entry.job, entries);
    }
  });

  // Create comparison data for each job
  return jobs.map((job) => {
    const jobEntries = entriesByJob.get(job.id) || [];
    const billingRate = calculateBillingRatePerM(job);

    // Calculate average actual cost if multiple entries exist
    let actualCostPerM: number | null = null;
    let lastUpdatedAt: number | undefined = undefined;

    if (jobEntries.length > 0) {
      const totalCost = jobEntries.reduce(
        (sum, entry) => sum + entry.actual_cost_per_m,
        0,
      );
      actualCostPerM = totalCost / jobEntries.length;

      // Find most recent entry timestamp
      lastUpdatedAt = Math.max(
        ...jobEntries.map((e) => e.updated_at || e.created_at),
      );
    }

    // Calculate profit metrics if we have cost data
    const profitMetrics =
      actualCostPerM !== null
        ? calculateJobProfitMetrics(job, actualCostPerM)
        : null;

    return {
      job,
      billing_rate_per_m: billingRate,
      actual_cost_per_m: actualCostPerM,
      profit_metrics: profitMetrics,
      entry_ids: jobEntries.map((e) => e.id),
      last_updated_at: lastUpdatedAt,
    };
  });
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

/**
 * Get color class for profit status
 */
export function getProfitColorClass(
  status: "excellent" | "good" | "warning" | "loss",
): string {
  switch (status) {
    case "excellent":
      return "text-green-700 bg-green-50 border-green-200";
    case "good":
      return "text-blue-700 bg-blue-50 border-blue-200";
    case "warning":
      return "text-yellow-700 bg-yellow-50 border-yellow-200";
    case "loss":
      return "text-red-700 bg-red-50 border-red-200";
  }
}

/**
 * Get text color class for profit values
 */
export function getProfitTextColor(profitPercentage: number): string {
  if (profitPercentage < 0) return "text-red-600";
  if (profitPercentage < 10) return "text-yellow-600";
  if (profitPercentage < 25) return "text-blue-600";
  return "text-green-600";
}

// ============================================================================
// Summary Statistics
// ============================================================================

/**
 * Calculate aggregate profit metrics for a set of jobs
 */
export function calculateAggregateProfitMetrics(
  comparisons: JobCostComparison[],
): {
  averageProfitPercentage: number;
  totalProfit: number;
  mostProfitableJob: JobCostComparison | null;
  jobsAtRisk: JobCostComparison[];
  jobsWithCostData: number;
  jobsWithoutCostData: number;
} {
  const withCostData = comparisons.filter((c) => c.profit_metrics !== null);
  const withoutCostData = comparisons.filter((c) => c.profit_metrics === null);

  // Calculate average profit percentage
  const avgProfitPercentage =
    withCostData.length > 0
      ? withCostData.reduce(
          (sum, c) => sum + (c.profit_metrics?.profit_percentage || 0),
          0,
        ) / withCostData.length
      : 0;

  // Calculate total profit
  const totalProfit = withCostData.reduce(
    (sum, c) => sum + (c.profit_metrics?.total_profit || 0),
    0,
  );

  // Find most profitable job
  const mostProfitable =
    withCostData.length > 0
      ? withCostData.reduce((best, current) => {
          const bestProfit = best.profit_metrics?.total_profit || 0;
          const currentProfit = current.profit_metrics?.total_profit || 0;
          return currentProfit > bestProfit ? current : best;
        })
      : null;

  // Find jobs at risk (profit percentage < 10% or negative)
  const atRisk = withCostData.filter((c) => {
    const profitPct = c.profit_metrics?.profit_percentage || 0;
    return profitPct < 10;
  });

  return {
    averageProfitPercentage: avgProfitPercentage,
    totalProfit,
    mostProfitableJob: mostProfitable,
    jobsAtRisk: atRisk,
    jobsWithCostData: withCostData.length,
    jobsWithoutCostData: withoutCostData.length,
  };
}
