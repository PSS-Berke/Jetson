import { Job, JobRequirement } from "@/types";
import { ParsedJob } from "@/hooks/useJobs";

// ============================================================================
// FINANCIAL HEALTH UTILITY FUNCTIONS
// Functions for identifying and filtering jobs with financial data issues
// ============================================================================

// ----------------------------------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------------------------------

export type FinancialIssueType =
  | "missing_billing"
  | "discrepancy"
  | "zero_pricing"
  | "hours_exceeded";

export interface FinancialHealthSummary {
  totalJobs: number;
  missingBilling: number;
  discrepancies: number;
  zeroPricing: number;
  hoursExceeded: number;
  healthyJobs: number;
  healthPercentage: number;
}

export interface JobWithFinancialIssues {
  job: Job | ParsedJob;
  issues: FinancialIssueType[];
  calculatedBilling: number;
  actualBilling: number;
  discrepancyAmount: number;
  discrepancyPercent: number;
  hoursEstimate: number | null;
  maxHours: number | null;
}

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Parse requirements from a job (handles both string and array formats)
 */
function parseRequirements(job: Job | ParsedJob): JobRequirement[] {
  if ("parsedRequirements" in job && Array.isArray(job.parsedRequirements)) {
    return job.parsedRequirements;
  }

  if (typeof job.requirements === "string" && job.requirements) {
    try {
      const parsed = JSON.parse(job.requirements);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (Array.isArray(job.requirements)) {
    return job.requirements as unknown as JobRequirement[];
  }

  return [];
}

/**
 * Calculate billing from requirements (sum of all price_per_m * quantity/1000)
 */
export function calculateBillingFromRequirements(job: Job | ParsedJob): number {
  const requirements = parseRequirements(job);
  const quantity = job.quantity || 0;

  if (requirements.length === 0 || quantity === 0) {
    return 0;
  }

  let totalBilling = 0;

  requirements.forEach((req) => {
    const pricePerMStr = req.price_per_m;
    if (pricePerMStr && pricePerMStr !== "undefined" && pricePerMStr !== "null") {
      const pricePerM = parseFloat(pricePerMStr);
      if (!isNaN(pricePerM) && pricePerM > 0) {
        totalBilling += (quantity / 1000) * pricePerM;
      }
    }

    // Also sum any additional cost fields (fields ending with _cost)
    Object.keys(req).forEach((key) => {
      if (key.endsWith("_cost") && key !== "price_per_m") {
        const costValue = req[key];
        if (costValue && typeof costValue === "string") {
          const cost = parseFloat(costValue);
          if (!isNaN(cost) && cost > 0) {
            totalBilling += cost;
          }
        }
      }
    });
  });

  // Add add-on charges if present
  const addOnCharges = parseFloat(job.add_on_charges || "0");
  if (!isNaN(addOnCharges)) {
    totalBilling += addOnCharges;
  }

  return totalBilling;
}

/**
 * Get the actual billing value from the job
 */
export function getActualBilling(job: Job | ParsedJob): number {
  return parseFloat(job.total_billing || "0") || 0;
}

/**
 * Detect billing discrepancy between requirements and total_billing
 * Returns the variance amount and percentage
 */
export function detectBillingDiscrepancy(job: Job | ParsedJob): {
  hasDiscrepancy: boolean;
  calculatedBilling: number;
  actualBilling: number;
  discrepancyAmount: number;
  discrepancyPercent: number;
} {
  const calculatedBilling = calculateBillingFromRequirements(job);
  const actualBilling = getActualBilling(job);

  // If both are 0, no discrepancy
  if (calculatedBilling === 0 && actualBilling === 0) {
    return {
      hasDiscrepancy: false,
      calculatedBilling: 0,
      actualBilling: 0,
      discrepancyAmount: 0,
      discrepancyPercent: 0,
    };
  }

  const discrepancyAmount = Math.abs(calculatedBilling - actualBilling);
  const baseValue = Math.max(calculatedBilling, actualBilling);
  const discrepancyPercent = baseValue > 0 ? (discrepancyAmount / baseValue) * 100 : 0;

  // Consider it a discrepancy if difference is > 5% and > $10
  const hasDiscrepancy = discrepancyPercent > 5 && discrepancyAmount > 10;

  return {
    hasDiscrepancy,
    calculatedBilling,
    actualBilling,
    discrepancyAmount,
    discrepancyPercent,
  };
}

// ----------------------------------------------------------------------------
// FILTERING FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Get jobs with missing billing information
 * Jobs where total_billing is 0 or empty but has requirements
 */
export function getJobsWithMissingBilling(jobs: (Job | ParsedJob)[]): (Job | ParsedJob)[] {
  return jobs.filter((job) => {
    const actualBilling = getActualBilling(job);
    const requirements = parseRequirements(job);

    // Has requirements but no billing
    if (requirements.length > 0 && actualBilling === 0) {
      return true;
    }

    // Has quantity but no billing and no requirements with pricing
    if (job.quantity > 0 && actualBilling === 0) {
      const hasAnyPricing = requirements.some((req) => {
        const price = parseFloat(req.price_per_m || "0");
        return price > 0;
      });
      return !hasAnyPricing;
    }

    return false;
  });
}

/**
 * Get jobs with pricing discrepancies
 * Jobs where total_billing doesn't match calculated from requirements
 */
export function getJobsWithDiscrepancies(jobs: (Job | ParsedJob)[]): (Job | ParsedJob)[] {
  return jobs.filter((job) => {
    const { hasDiscrepancy } = detectBillingDiscrepancy(job);
    return hasDiscrepancy;
  });
}

/**
 * Get jobs with $0 pricing in any requirement
 */
export function getJobsWithZeroPricing(jobs: (Job | ParsedJob)[]): (Job | ParsedJob)[] {
  return jobs.filter((job) => {
    const requirements = parseRequirements(job);

    if (requirements.length === 0) {
      return false;
    }

    // Check if any requirement has price_per_m = 0 or missing
    return requirements.some((req) => {
      const pricePerMStr = req.price_per_m;
      if (!pricePerMStr || pricePerMStr === "undefined" || pricePerMStr === "null") {
        return true;
      }
      const pricePerM = parseFloat(pricePerMStr);
      return isNaN(pricePerM) || pricePerM === 0;
    });
  });
}

/**
 * Get jobs where hours exceed the max_hours threshold
 */
export function getJobsExceedingHours(jobs: (Job | ParsedJob)[]): (Job | ParsedJob)[] {
  return jobs.filter((job) => {
    const maxHours = job.max_hours;
    const timeEstimate = job.time_estimate;

    if (maxHours == null || timeEstimate == null) {
      return false;
    }

    return timeEstimate > maxHours;
  });
}

/**
 * Get all jobs with their financial issues
 */
export function analyzeJobsFinancialHealth(
  jobs: (Job | ParsedJob)[]
): JobWithFinancialIssues[] {
  return jobs.map((job) => {
    const issues: FinancialIssueType[] = [];
    const discrepancyInfo = detectBillingDiscrepancy(job);
    const requirements = parseRequirements(job);

    // Check for missing billing
    const actualBilling = getActualBilling(job);
    if (requirements.length > 0 && actualBilling === 0) {
      issues.push("missing_billing");
    }

    // Check for discrepancy
    if (discrepancyInfo.hasDiscrepancy) {
      issues.push("discrepancy");
    }

    // Check for zero pricing
    const hasZeroPricing = requirements.some((req) => {
      const pricePerMStr = req.price_per_m;
      if (!pricePerMStr || pricePerMStr === "undefined" || pricePerMStr === "null") {
        return true;
      }
      const pricePerM = parseFloat(pricePerMStr);
      return isNaN(pricePerM) || pricePerM === 0;
    });
    if (hasZeroPricing && requirements.length > 0) {
      issues.push("zero_pricing");
    }

    // Check for hours exceeded
    if (job.max_hours != null && job.time_estimate != null && job.time_estimate > job.max_hours) {
      issues.push("hours_exceeded");
    }

    return {
      job,
      issues,
      calculatedBilling: discrepancyInfo.calculatedBilling,
      actualBilling: discrepancyInfo.actualBilling,
      discrepancyAmount: discrepancyInfo.discrepancyAmount,
      discrepancyPercent: discrepancyInfo.discrepancyPercent,
      hoursEstimate: job.time_estimate,
      maxHours: job.max_hours ?? null,
    };
  });
}

/**
 * Calculate financial health summary for a list of jobs
 */
export function calculateFinancialHealthSummary(
  jobs: (Job | ParsedJob)[]
): FinancialHealthSummary {
  const missingBillingJobs = getJobsWithMissingBilling(jobs);
  const discrepancyJobs = getJobsWithDiscrepancies(jobs);
  const zeroPricingJobs = getJobsWithZeroPricing(jobs);
  const hoursExceededJobs = getJobsExceedingHours(jobs);

  // Get unique jobs with any issue
  const jobsWithIssues = new Set<number>();
  [...missingBillingJobs, ...discrepancyJobs, ...zeroPricingJobs, ...hoursExceededJobs].forEach(
    (job) => jobsWithIssues.add(job.id)
  );

  const totalJobs = jobs.length;
  const healthyJobs = totalJobs - jobsWithIssues.size;
  const healthPercentage = totalJobs > 0 ? (healthyJobs / totalJobs) * 100 : 100;

  return {
    totalJobs,
    missingBilling: missingBillingJobs.length,
    discrepancies: discrepancyJobs.length,
    zeroPricing: zeroPricingJobs.length,
    hoursExceeded: hoursExceededJobs.length,
    healthyJobs,
    healthPercentage,
  };
}

/**
 * Filter jobs by issue type
 */
export function filterJobsByIssueType(
  jobs: (Job | ParsedJob)[],
  issueType: FinancialIssueType | "all"
): (Job | ParsedJob)[] {
  switch (issueType) {
    case "missing_billing":
      return getJobsWithMissingBilling(jobs);
    case "discrepancy":
      return getJobsWithDiscrepancies(jobs);
    case "zero_pricing":
      return getJobsWithZeroPricing(jobs);
    case "hours_exceeded":
      return getJobsExceedingHours(jobs);
    case "all":
    default:
      return jobs;
  }
}

// ----------------------------------------------------------------------------
// PROFIT / MARGIN HELPERS
// ----------------------------------------------------------------------------

/**
 * Calculate profit margin for a job
 * Uses actual_cost_per_m if available, otherwise estimates from ext_price
 */
export function calculateJobMargin(job: Job | ParsedJob): {
  billingRate: number;
  actualCost: number;
  profit: number;
  marginPercent: number;
  hasActualCost: boolean;
} {
  const billingRate = calculateBillingFromRequirements(job) || getActualBilling(job);
  const actualCostPerM = job.actual_cost_per_m;
  const quantity = job.quantity || 0;

  let actualCost = 0;
  let hasActualCost = false;

  if (actualCostPerM != null && actualCostPerM > 0) {
    actualCost = (quantity / 1000) * actualCostPerM;
    hasActualCost = true;
  } else {
    // Fallback to ext_price as estimated cost
    actualCost = parseFloat(job.ext_price || "0") || 0;
  }

  const profit = billingRate - actualCost;
  const marginPercent = billingRate > 0 ? (profit / billingRate) * 100 : 0;

  return {
    billingRate,
    actualCost,
    profit,
    marginPercent,
    hasActualCost,
  };
}

/**
 * Get margin status color class based on margin percentage
 */
export function getMarginStatusColor(marginPercent: number): string {
  if (marginPercent >= 25) return "text-green-600";
  if (marginPercent >= 15) return "text-green-500";
  if (marginPercent >= 10) return "text-yellow-600";
  if (marginPercent >= 0) return "text-orange-500";
  return "text-red-600";
}

/**
 * Get margin status label based on margin percentage
 */
export function getMarginStatusLabel(marginPercent: number): string {
  if (marginPercent >= 25) return "Excellent";
  if (marginPercent >= 15) return "Good";
  if (marginPercent >= 10) return "Fair";
  if (marginPercent >= 0) return "Low";
  return "Loss";
}
