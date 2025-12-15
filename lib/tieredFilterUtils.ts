/**
 * Tiered Filter Utilities
 *
 * This module provides utilities for building and applying tiered filters
 * for the projections page. The tiered filter system organizes jobs by:
 *
 * Tier 1: Process Type (Insert, Laser, Fold, etc.)
 * Tier 2: Primary Category - Basic OE / Envelope Size (stored as paper_size)
 * Tier 3: Sub-categories (Read Write, Affix, Match, Pockets, etc.)
 */

import type { ParsedJob } from "@/hooks/useJobs";
import type { JobProjection } from "@/hooks/useProjections";
import type { TimeRange } from "@/lib/projectionUtils";
import { normalizeProcessType, getProcessTypeConfig, PROCESS_TYPE_CONFIGS } from "./processTypeConfig";

/**
 * Represents a selected filter at any tier level
 */
export interface TieredFilter {
  processType?: string;           // Tier 1: e.g., "insert", "laser"
  primaryCategory?: string;       // Tier 2: e.g., "6x9", "9x12" (Basic OE / Envelope Size)
  subCategories?: Record<string, string[]>; // Tier 3: e.g., { read_write: ["TRUE"], affix: ["Label", "None"] }
}

/**
 * Represents aggregated data for a tier item (with job counts)
 */
export interface TierItem {
  value: string;
  label: string;
  count: number;        // Number of jobs
  totalQuantity: number; // Sum of job quantities
}

/**
 * Represents the full tiered data structure for the dropdown
 */
export interface TieredData {
  // Tier 1: Process types with counts
  processTypes: TierItem[];

  // Tier 2: Primary categories (Basic OE / Envelope Size) grouped by process type
  primaryCategories: Map<string, TierItem[]>;

  // Tier 3: Sub-fields grouped by process type and primary category
  // Key format: "processType:primaryCategory"
  subCategories: Map<string, Map<string, TierItem[]>>;
}

/**
 * Get the primary category value from a job's requirements
 * Checks for basic_oe first (preferred), then paper_size
 */
export function getPrimaryCategoryValue(
  job: ParsedJob,
  processType: string
): string | undefined {
  if (!job.requirements || job.requirements.length === 0) {
    return undefined;
  }

  const normalizedProcessType = normalizeProcessType(processType);

  // Find the requirement matching the process type
  const requirement = job.requirements.find((req) => {
    if (!req.process_type) return false;
    return normalizeProcessType(req.process_type) === normalizedProcessType;
  });

  if (!requirement) {
    return undefined;
  }

  // Check for basic_oe first (it's the preferred field name)
  const basicOe = (requirement as any).basic_oe;
  if (basicOe && basicOe !== "" && basicOe !== "undefined" && basicOe !== "null") {
    return String(basicOe);
  }

  // Fall back to paper_size
  const paperSize = (requirement as any).paper_size;
  if (paperSize && paperSize !== "" && paperSize !== "undefined" && paperSize !== "null") {
    return String(paperSize);
  }

  return undefined;
}

/**
 * Get a sub-category field value from a job's requirements
 */
export function getSubCategoryValue(
  job: ParsedJob,
  processType: string,
  fieldName: string
): string | undefined {
  if (!job.requirements || job.requirements.length === 0) {
    return undefined;
  }

  const normalizedProcessType = normalizeProcessType(processType);

  // Find the requirement matching the process type
  const requirement = job.requirements.find((req) => {
    if (!req.process_type) return false;
    return normalizeProcessType(req.process_type) === normalizedProcessType;
  });

  if (!requirement) {
    return undefined;
  }

  const value = (requirement as any)[fieldName];
  if (value !== undefined && value !== null && value !== "" && value !== "undefined" && value !== "null") {
    return String(value);
  }

  return undefined;
}

/**
 * Get all process types present in a job
 */
export function getJobProcessTypes(job: ParsedJob): string[] {
  if (!job.requirements || job.requirements.length === 0) {
    return [];
  }

  const processTypes = new Set<string>();
  job.requirements.forEach((req) => {
    if (req.process_type) {
      const normalized = normalizeProcessType(req.process_type);
      processTypes.add(normalized);
    }
  });

  return Array.from(processTypes);
}

/**
 * Get the sub-category fields for a process type (excluding price and primary category)
 */
export function getSubCategoryFields(processType: string): Array<{ name: string; label: string }> {
  const config = getProcessTypeConfig(processType);
  if (!config) {
    return [];
  }

  // Exclude price fields and the primary category field (paper_size)
  return config.fields
    .filter((field) => {
      // Exclude currency/price fields
      if (field.type === "currency" || field.name.includes("price")) {
        return false;
      }
      // Exclude the primary category field
      if (field.name === "paper_size") {
        return false;
      }
      return true;
    })
    .map((field) => ({
      name: field.name,
      label: field.label,
    }));
}

/**
 * Build the tiered data structure from a list of jobs
 */
export function buildTieredData(jobs: ParsedJob[]): TieredData {
  const processTypeCounts = new Map<string, { count: number; quantity: number }>();
  const primaryCategoryCounts = new Map<string, Map<string, { count: number; quantity: number }>>();
  const subCategoryCounts = new Map<string, Map<string, Map<string, { count: number; quantity: number }>>>();

  // Process each job
  jobs.forEach((job) => {
    const jobProcessTypes = getJobProcessTypes(job);
    const jobQuantity = job.quantity || 0;

    jobProcessTypes.forEach((processType) => {
      // Count Tier 1: Process Type
      const existing = processTypeCounts.get(processType) || { count: 0, quantity: 0 };
      processTypeCounts.set(processType, {
        count: existing.count + 1,
        quantity: existing.quantity + jobQuantity,
      });

      // Count Tier 2: Primary Category (Basic OE / Envelope Size)
      const primaryCategory = getPrimaryCategoryValue(job, processType);
      if (primaryCategory) {
        if (!primaryCategoryCounts.has(processType)) {
          primaryCategoryCounts.set(processType, new Map());
        }
        const processCategories = primaryCategoryCounts.get(processType)!;
        const existingCategory = processCategories.get(primaryCategory) || { count: 0, quantity: 0 };
        processCategories.set(primaryCategory, {
          count: existingCategory.count + 1,
          quantity: existingCategory.quantity + jobQuantity,
        });

        // Count Tier 3: Sub-categories
        const subFields = getSubCategoryFields(processType);
        const categoryKey = `${processType}:${primaryCategory}`;

        if (!subCategoryCounts.has(categoryKey)) {
          subCategoryCounts.set(categoryKey, new Map());
        }
        const subFieldMap = subCategoryCounts.get(categoryKey)!;

        subFields.forEach((field) => {
          const fieldValue = getSubCategoryValue(job, processType, field.name);
          if (fieldValue) {
            if (!subFieldMap.has(field.name)) {
              subFieldMap.set(field.name, new Map());
            }
            const fieldValues = subFieldMap.get(field.name)!;
            const existingValue = fieldValues.get(fieldValue) || { count: 0, quantity: 0 };
            fieldValues.set(fieldValue, {
              count: existingValue.count + 1,
              quantity: existingValue.quantity + jobQuantity,
            });
          }
        });
      }
    });
  });

  // Convert to TieredData structure
  const processTypes: TierItem[] = [];
  PROCESS_TYPE_CONFIGS.forEach((config) => {
    const data = processTypeCounts.get(config.key);
    if (data && data.count > 0) {
      processTypes.push({
        value: config.key,
        label: config.label,
        count: data.count,
        totalQuantity: data.quantity,
      });
    }
  });

  // Sort by count descending
  processTypes.sort((a, b) => b.count - a.count);

  const primaryCategories = new Map<string, TierItem[]>();
  primaryCategoryCounts.forEach((categories, processType) => {
    const items: TierItem[] = [];
    categories.forEach((data, category) => {
      items.push({
        value: category,
        label: category,
        count: data.count,
        totalQuantity: data.quantity,
      });
    });
    // Sort by count descending
    items.sort((a, b) => b.count - a.count);
    primaryCategories.set(processType, items);
  });

  const subCategories = new Map<string, Map<string, TierItem[]>>();
  subCategoryCounts.forEach((fieldMap, categoryKey) => {
    const processType = categoryKey.split(":")[0];
    const subFields = getSubCategoryFields(processType);
    const fieldItemsMap = new Map<string, TierItem[]>();

    subFields.forEach((field) => {
      const values = fieldMap.get(field.name);
      if (values && values.size > 0) {
        const items: TierItem[] = [];
        values.forEach((data, value) => {
          items.push({
            value: value,
            label: `${field.label}: ${value}`,
            count: data.count,
            totalQuantity: data.quantity,
          });
        });
        // Sort by count descending
        items.sort((a, b) => b.count - a.count);
        fieldItemsMap.set(field.name, items);
      }
    });

    if (fieldItemsMap.size > 0) {
      subCategories.set(categoryKey, fieldItemsMap);
    }
  });

  return {
    processTypes,
    primaryCategories,
    subCategories,
  };
}

/**
 * Apply tiered filters to a list of jobs
 * Returns only jobs that match all specified filter criteria
 */
export function applyTieredFilters(jobs: ParsedJob[], filters: TieredFilter): ParsedJob[] {
  // If no filters are set, return all jobs
  if (!filters.processType && !filters.primaryCategory &&
      (!filters.subCategories || Object.keys(filters.subCategories).length === 0)) {
    return jobs;
  }

  return jobs.filter((job) => {
    // Check Tier 1: Process Type
    if (filters.processType) {
      const jobProcessTypes = getJobProcessTypes(job);
      if (!jobProcessTypes.includes(filters.processType)) {
        return false;
      }
    }

    // Check Tier 2: Primary Category (Basic OE / Envelope Size)
    if (filters.primaryCategory && filters.processType) {
      const primaryCategory = getPrimaryCategoryValue(job, filters.processType);
      if (primaryCategory !== filters.primaryCategory) {
        return false;
      }
    }

    // Check Tier 3: Sub-categories
    if (filters.subCategories && filters.processType) {
      for (const [fieldName, allowedValues] of Object.entries(filters.subCategories)) {
        if (allowedValues.length === 0) continue;

        const fieldValue = getSubCategoryValue(job, filters.processType, fieldName);
        if (!fieldValue || !allowedValues.includes(fieldValue)) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Check if any tiered filters are active
 */
export function hasActiveTieredFilters(filters: TieredFilter): boolean {
  if (filters.processType) return true;
  if (filters.primaryCategory) return true;
  if (filters.subCategories && Object.keys(filters.subCategories).length > 0) {
    // Check if any sub-category has values selected
    for (const values of Object.values(filters.subCategories)) {
      if (values.length > 0) return true;
    }
  }
  return false;
}

/**
 * Get a human-readable description of the active filters
 */
export function getTieredFilterDescription(filters: TieredFilter): string {
  const parts: string[] = [];

  if (filters.processType) {
    const config = getProcessTypeConfig(filters.processType);
    parts.push(config?.label || filters.processType);
  }

  if (filters.primaryCategory) {
    parts.push(filters.primaryCategory);
  }

  if (filters.subCategories) {
    for (const [fieldName, values] of Object.entries(filters.subCategories)) {
      if (values.length > 0) {
        parts.push(`${fieldName}: ${values.join(", ")}`);
      }
    }
  }

  return parts.join(" → ");
}

/**
 * Represents a primary category (Tier 2) with time period totals for summary display
 */
export interface SummaryPrimaryCategory {
  value: string;
  label: string;
  count: number;
  weeklyTotals: Map<string, number>;
  grandTotal: number;
}

/**
 * Represents a sub-category item (Tier 3) with time period totals for summary display
 */
export interface SummarySubCategory {
  fieldName: string;
  fieldLabel: string;
  value: string;
  count: number;
  weeklyTotals: Map<string, number>;
  grandTotal: number;
}

/**
 * Build tiered summary data for a specific process type with time period totals
 * This is used to render Tier 2 and Tier 3 rows in the summary section
 */
export function buildSummaryTieredData(
  projections: JobProjection[],
  processType: string,
  timeRanges: TimeRange[]
): {
  primaryCategories: SummaryPrimaryCategory[];
  subCategories: Map<string, SummarySubCategory[]>;
} {
  const normalizedProcessType = normalizeProcessType(processType);

  // Filter projections to only include jobs with this process type
  const relevantProjections = projections.filter((projection) => {
    const jobProcessTypes = getJobProcessTypes(projection.job);
    return jobProcessTypes.includes(normalizedProcessType);
  });

  // Build primary category data (Tier 2)
  const primaryCategoryMap = new Map<string, {
    count: number;
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  }>();

  // Build sub-category data (Tier 3), keyed by primary category value
  const subCategoryMap = new Map<string, Map<string, Map<string, {
    count: number;
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  }>>>();

  // Special key for jobs without a primary category
  const MISC_CATEGORY = "Misc";

  relevantProjections.forEach((projection) => {
    const job = projection.job;
    let primaryCategory = getPrimaryCategoryValue(job, normalizedProcessType);

    // Jobs without a primary category go into "Misc"
    if (!primaryCategory) {
      primaryCategory = MISC_CATEGORY;
    }

    // Update primary category totals
    if (!primaryCategoryMap.has(primaryCategory)) {
      primaryCategoryMap.set(primaryCategory, {
        count: 0,
        weeklyTotals: new Map(),
        grandTotal: 0,
      });
    }
    const categoryData = primaryCategoryMap.get(primaryCategory)!;
    categoryData.count += 1;
    categoryData.grandTotal += projection.totalQuantity;

    // Add weekly totals
    projection.weeklyQuantities.forEach((qty, label) => {
      const existing = categoryData.weeklyTotals.get(label) || 0;
      categoryData.weeklyTotals.set(label, existing + qty);
    });

    // Update sub-category totals (Tier 3) - skip for Misc category
    if (primaryCategory !== MISC_CATEGORY) {
      const subFields = getSubCategoryFields(normalizedProcessType);

      if (!subCategoryMap.has(primaryCategory)) {
        subCategoryMap.set(primaryCategory, new Map());
      }
      const categorySubFields = subCategoryMap.get(primaryCategory)!;

      subFields.forEach((field) => {
        const fieldValue = getSubCategoryValue(job, normalizedProcessType, field.name);
        if (!fieldValue) return;

        const fieldKey = field.name;
        if (!categorySubFields.has(fieldKey)) {
          categorySubFields.set(fieldKey, new Map());
        }
        const fieldValues = categorySubFields.get(fieldKey)!;

        if (!fieldValues.has(fieldValue)) {
          fieldValues.set(fieldValue, {
            count: 0,
            weeklyTotals: new Map(),
            grandTotal: 0,
          });
        }
        const valueData = fieldValues.get(fieldValue)!;
        valueData.count += 1;
        valueData.grandTotal += projection.totalQuantity;

        // Add weekly totals
        projection.weeklyQuantities.forEach((qty, label) => {
          const existing = valueData.weeklyTotals.get(label) || 0;
          valueData.weeklyTotals.set(label, existing + qty);
        });
      });
    }
  });

  // Convert to output format
  const primaryCategories: SummaryPrimaryCategory[] = [];
  primaryCategoryMap.forEach((data, value) => {
    primaryCategories.push({
      value,
      label: value,
      count: data.count,
      weeklyTotals: data.weeklyTotals,
      grandTotal: data.grandTotal,
    });
  });
  // Sort by grand total descending
  primaryCategories.sort((a, b) => b.grandTotal - a.grandTotal);

  // Convert sub-categories to output format
  const subCategories = new Map<string, SummarySubCategory[]>();
  const subFields = getSubCategoryFields(normalizedProcessType);

  subCategoryMap.forEach((fieldMap, primaryCategoryValue) => {
    const items: SummarySubCategory[] = [];

    fieldMap.forEach((valueMap, fieldName) => {
      const fieldConfig = subFields.find(f => f.name === fieldName);
      const fieldLabel = fieldConfig?.label || fieldName;

      valueMap.forEach((data, value) => {
        items.push({
          fieldName,
          fieldLabel,
          value,
          count: data.count,
          weeklyTotals: data.weeklyTotals,
          grandTotal: data.grandTotal,
        });
      });
    });

    // Sort by grand total descending
    items.sort((a, b) => b.grandTotal - a.grandTotal);
    subCategories.set(primaryCategoryValue, items);
  });

  return {
    primaryCategories,
    subCategories,
  };
}
