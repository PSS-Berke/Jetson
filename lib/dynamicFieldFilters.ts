/**
 * Utility functions for dynamic field filtering
 * Supports filtering jobs based on custom fields defined in machine_variables
 */

import { getAllMachineVariables } from "./api";
import {
  normalizeProcessType,
  getSourceTypesForProcessType,
} from "./processTypeConfig";
import type {
  DynamicFieldFilter,
  DynamicFieldDefinition,
  DynamicFieldOperator,
  DynamicFieldFilterValue,
  JobRequirement,
} from "@/types";
import type { ParsedJob } from "@/hooks/useJobs";

/**
 * Fetch available field definitions for a given process type
 * Merges fields from all source types associated with the normalized process type
 */
export async function getAvailableFieldsForProcessType(
  processType: string,
): Promise<DynamicFieldDefinition[]> {
  // Normalize the process type
  const normalized = normalizeProcessType(processType);

  // Get all source types for this normalized type
  const sourceTypes = getSourceTypesForProcessType(normalized);

  // Fetch all machine variables
  const allVariables = await getAllMachineVariables();

  // Find matching records
  const matchingRecords = allVariables.filter((record) =>
    sourceTypes.includes(record.type),
  );

  // Merge variables from all matching records
  const mergedVariables: Record<string, any> = {};
  matchingRecords.forEach((record) => {
    if (record.variables) {
      Object.entries(record.variables).forEach(([name, config]: [string, any]) => {
        // Only include fields marked for job input
        if (config.addToJobInput === true) {
          mergedVariables[name] = config;
        }
      });
    }
  });

  // Convert to DynamicFieldDefinition array
  const fields: DynamicFieldDefinition[] = Object.entries(mergedVariables).map(
    ([name, config]: [string, any]) => ({
      name,
      label: config.label || name,
      type: config.type || "text",
      options: config.options,
      required: config.required,
      validation: config.validation,
    }),
  );

  // Sort by label for consistent ordering
  fields.sort((a, b) => a.label.localeCompare(b.label));

  return fields;
}

/**
 * Extract unique values for a specific field across all jobs
 * Useful for populating filter dropdowns with actual values from the dataset
 */
export function getFieldValueOptions(
  jobs: ParsedJob[],
  processType: string,
  fieldName: string,
): string[] {
  const normalized = normalizeProcessType(processType);
  const values = new Set<string>();

  jobs.forEach((job) => {
    if (job.requirements) {
      job.requirements.forEach((req: any) => {
        // Match process type
        if (normalizeProcessType(req.process_type) === normalized) {
          const value = req[fieldName];
          if (value !== undefined && value !== null && value !== "") {
            values.add(String(value));
          }
        }
      });
    }
  });

  return Array.from(values).sort();
}

/**
 * Get appropriate operators for a given field type
 */
export function getOperatorsForFieldType(
  fieldType: string,
): Array<{ value: DynamicFieldOperator; label: string }> {
  switch (fieldType) {
    case "boolean":
      return [
        { value: "is_true", label: "Is True" },
        { value: "is_false", label: "Is False" },
        { value: "is_empty", label: "Is Empty" },
        { value: "is_not_empty", label: "Has Value" },
      ];

    case "number":
    case "integer":
    case "currency":
      return [
        { value: "equals", label: "Equals" },
        { value: "not_equals", label: "Not Equals" },
        { value: "greater_than", label: "Greater Than" },
        { value: "less_than", label: "Less Than" },
        { value: "greater_than_or_equal", label: "Greater Than or Equal" },
        { value: "less_than_or_equal", label: "Less Than or Equal" },
        { value: "between", label: "Between" },
        { value: "is_empty", label: "Is Empty" },
        { value: "is_not_empty", label: "Has Value" },
      ];

    case "select":
    case "dropdown":
      return [
        { value: "equals", label: "Equals" },
        { value: "not_equals", label: "Not Equals" },
        { value: "in", label: "Is One Of" },
        { value: "not_in", label: "Is Not One Of" },
        { value: "is_empty", label: "Is Empty" },
        { value: "is_not_empty", label: "Has Value" },
      ];

    case "text":
    default:
      return [
        { value: "equals", label: "Equals" },
        { value: "not_equals", label: "Not Equals" },
        { value: "contains", label: "Contains" },
        { value: "not_contains", label: "Does Not Contain" },
        { value: "is_empty", label: "Is Empty" },
        { value: "is_not_empty", label: "Has Value" },
      ];
  }
}

/**
 * Evaluate a single filter against a field value
 */
export function evaluateFilter(
  fieldValue: any,
  operator: DynamicFieldOperator,
  filterValue: DynamicFieldFilterValue,
): boolean {
  // Handle empty/not empty checks first
  const isEmpty = fieldValue === undefined || fieldValue === null || fieldValue === "";

  if (operator === "is_empty") {
    return isEmpty;
  }

  if (operator === "is_not_empty") {
    return !isEmpty;
  }

  // If field is empty and we're not checking for emptiness, handle based on operator
  if (isEmpty) {
    // For negative operators (not_equals, not_contains, not_in), an empty field
    // doesn't match the filter value, so it should pass
    const negativeOperators: DynamicFieldOperator[] = ["not_equals", "not_contains", "not_in"];
    if (negativeOperators.includes(operator)) {
      return true; // Empty field doesn't equal/contain the value, so it passes
    }
    return false; // Empty field can't equal/contain a value, so it fails
  }

  // Convert values for comparison (trim whitespace and normalize case)
  const normalizedFieldValue = String(fieldValue).trim().toLowerCase();
  const normalizedFilterValue =
    typeof filterValue === "string" ? filterValue.trim().toLowerCase() : filterValue;

  switch (operator) {
    case "equals":
      if (typeof filterValue === "boolean") {
        return fieldValue === filterValue;
      }
      if (typeof filterValue === "number") {
        return Number(fieldValue) === filterValue;
      }
      return normalizedFieldValue === normalizedFilterValue;

    case "not_equals":
      if (typeof filterValue === "boolean") {
        return fieldValue !== filterValue;
      }
      if (typeof filterValue === "number") {
        return Number(fieldValue) !== filterValue;
      }
      return normalizedFieldValue !== normalizedFilterValue;

    case "in":
      if (Array.isArray(filterValue)) {
        return filterValue.some(
          (val) => String(val).toLowerCase() === normalizedFieldValue,
        );
      }
      return false;

    case "not_in":
      if (Array.isArray(filterValue)) {
        return !filterValue.some(
          (val) => String(val).toLowerCase() === normalizedFieldValue,
        );
      }
      return true;

    case "contains":
      return normalizedFieldValue.includes(String(normalizedFilterValue));

    case "not_contains":
      return !normalizedFieldValue.includes(String(normalizedFilterValue));

    case "greater_than":
      return Number(fieldValue) > Number(filterValue);

    case "less_than":
      return Number(fieldValue) < Number(filterValue);

    case "greater_than_or_equal":
      return Number(fieldValue) >= Number(filterValue);

    case "less_than_or_equal":
      return Number(fieldValue) <= Number(filterValue);

    case "between":
      if (
        typeof filterValue === "object" &&
        filterValue !== null &&
        "min" in filterValue &&
        "max" in filterValue
      ) {
        const numValue = Number(fieldValue);
        return numValue >= filterValue.min && numValue <= filterValue.max;
      }
      return false;

    case "is_true":
      return fieldValue === true || fieldValue === 1 || fieldValue === "true";

    case "is_false":
      return fieldValue === false || fieldValue === 0 || fieldValue === "false";

    default:
      return false;
  }
}

/**
 * Apply dynamic field filters to a single job
 * Returns true if the job passes all filters
 */
export function applyDynamicFieldFilters(
  job: ParsedJob,
  filters: DynamicFieldFilter[],
  filterLogic: "and" | "or" = "and",
): boolean {
  if (filters.length === 0) {
    return true; // No filters = show all
  }

  const results = filters.map((filter) => {
    // First check if job has any requirements
    if (!job.requirements || job.requirements.length === 0) {
      console.log(`[DynamicFilter] Job ${job.job_number} has no requirements, excluding`);
      return false;
    }

    // Check if job has this process type at all
    const filterProcessType = normalizeProcessType(filter.processType);
    const hasProcessType = job.requirements.some((req: any) => {
      const reqProcessType = normalizeProcessType(req.process_type);
      return reqProcessType === filterProcessType;
    });

    if (!hasProcessType) {
      console.log(
        `[DynamicFilter] Job ${job.job_number} doesn't have process type "${filter.processType}", excluding`
      );
      return false;
    }

    // Check if any requirement matches this filter
    const hasMatchingRequirement = job.requirements.some((req: any) => {
      // Normalize process types for comparison
      const reqProcessType = normalizeProcessType(req.process_type);

      // Skip if requirement doesn't match filter's process type
      if (reqProcessType !== filterProcessType) {
        return false;
      }

      // Get the field value from the requirement
      const fieldValue = req[filter.fieldName];

      // Log for debugging
      console.log(`[DynamicFilter] Evaluating job ${job.job_number}:`, {
        processType: filter.processType,
        fieldName: filter.fieldName,
        fieldLabel: filter.fieldLabel,
        operator: filter.operator,
        filterValue: filter.value,
        actualValue: fieldValue,
      });

      // Evaluate the filter
      const result = evaluateFilter(fieldValue, filter.operator, filter.value);

      console.log(`[DynamicFilter] Filter result: ${result}`);

      return result;
    });

    return hasMatchingRequirement || false;
  });

  // Apply AND or OR logic
  const finalResult = filterLogic === "and"
    ? results.every((result) => result === true)
    : results.some((result) => result === true);

  console.log(
    `[DynamicFilter] Final result for job ${job.job_number}: ${finalResult} (logic: ${filterLogic})`
  );

  return finalResult;
}

/**
 * Get a default filter value for a given operator and field type
 */
export function getDefaultValueForOperator(
  operator: DynamicFieldOperator,
  fieldType: string,
  options?: string[],
): DynamicFieldFilterValue {
  switch (operator) {
    case "is_true":
      return true;
    case "is_false":
      return false;
    case "is_empty":
    case "is_not_empty":
      return null;
    case "in":
    case "not_in":
      return options && options.length > 0 ? [options[0]] : [];
    case "between":
      return { min: 0, max: 100 };
    case "equals":
    case "not_equals":
      if (fieldType === "boolean") return false;
      if (fieldType === "number" || fieldType === "integer" || fieldType === "currency") return 0;
      if (options && options.length > 0) return options[0];
      return "";
    case "greater_than":
    case "less_than":
    case "greater_than_or_equal":
    case "less_than_or_equal":
      return 0;
    default:
      return "";
  }
}

/**
 * Validate that a filter configuration is complete and valid
 */
export function isValidFilter(filter: Partial<DynamicFieldFilter>): boolean {
  if (!filter.processType || !filter.fieldName || !filter.operator) {
    return false;
  }

  // Check if value is required and present
  const operatorsRequiringValue: DynamicFieldOperator[] = [
    "equals",
    "not_equals",
    "in",
    "not_in",
    "contains",
    "not_contains",
    "greater_than",
    "less_than",
    "greater_than_or_equal",
    "less_than_or_equal",
    "between",
  ];

  if (operatorsRequiringValue.includes(filter.operator)) {
    if (filter.value === undefined || filter.value === null) {
      return false;
    }

    // Check array operators have non-empty arrays
    if ((filter.operator === "in" || filter.operator === "not_in") && Array.isArray(filter.value)) {
      return filter.value.length > 0;
    }

    // Check between operator has valid range
    if (filter.operator === "between" && typeof filter.value === "object" && filter.value !== null) {
      const range = filter.value as { min: number; max: number };
      return range.min !== undefined && range.max !== undefined && range.min <= range.max;
    }
  }

  return true;
}
