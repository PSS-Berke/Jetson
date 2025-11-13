import { ParsedJob } from "@/hooks/useJobs";
import { ProductionEntry } from "@/types";
import { ParsedExcelRow } from "./excelParser";

/**
 * Validation result for a single Excel row
 */
export interface ValidationResult {
  isValid: boolean;
  matchedJob?: ParsedJob;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
}

/**
 * Validated Excel row ready for production entry creation
 */
export interface ValidatedProductionRow extends ParsedExcelRow {
  matchedJob: ParsedJob;
  validation: ValidationResult;
  productionEntry?: Omit<ProductionEntry, "id" | "created_at" | "updated_at">;
}

/**
 * Options for production validation
 */
export interface ValidationOptions {
  facilitiesId?: number;
  allowFutureDates?: boolean;
  checkDuplicates?: boolean;
  existingEntries?: ProductionEntry[];
  defaultDate?: Date | number;
}

/**
 * Validates a single Excel row against job data
 * @param row - Parsed Excel row
 * @param jobs - Array of all jobs
 * @param options - Validation options
 * @returns Validation result with matched job and any errors/warnings
 */
export function validateProductionRow(
  row: ParsedExcelRow,
  jobs: ParsedJob[],
  options: ValidationOptions = {},
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // 1. Validate and match job number
  const matchedJob = findJobByJobNumber(row.jobNumber, jobs);

  if (!matchedJob) {
    result.isValid = false;
    result.errors.push({
      field: "jobNumber",
      message: `Job number "${row.jobNumber}" not found in system`,
    });
    return result; // Can't continue without a valid job
  }

  result.matchedJob = matchedJob;

  // 2. Check facility mismatch
  if (
    options.facilitiesId &&
    matchedJob.facilities_id !== options.facilitiesId
  ) {
    result.warnings.push({
      field: "facilities_id",
      message: `Job belongs to a different facility (expected: ${options.facilitiesId}, found: ${matchedJob.facilities_id})`,
    });
  }

  // 3. Validate quantity
  if (row.quantity <= 0) {
    result.isValid = false;
    result.errors.push({
      field: "quantity",
      message: "Quantity must be greater than 0",
    });
  }

  // Check if quantity exceeds job total
  if (matchedJob.quantity && row.quantity > matchedJob.quantity) {
    result.warnings.push({
      field: "quantity",
      message: `Quantity (${row.quantity}) exceeds job total (${matchedJob.quantity})`,
    });
  }

  // 4. Validate date
  let entryDate: number;

  if (row.date) {
    const dateObj = row.date instanceof Date ? row.date : new Date(row.date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      result.isValid = false;
      result.errors.push({
        field: "date",
        message: "Invalid date format",
      });
      return result;
    }

    // Check if date is in the future
    if (!options.allowFutureDates && dateObj.getTime() > Date.now()) {
      result.warnings.push({
        field: "date",
        message: "Date is in the future",
      });
    }

    // Check if date is before job start date
    if (matchedJob.start_date && dateObj.getTime() < matchedJob.start_date) {
      result.warnings.push({
        field: "date",
        message: `Date is before job start date (${new Date(matchedJob.start_date).toLocaleDateString()})`,
      });
    }

    // Check if date is after job due date
    if (matchedJob.due_date && dateObj.getTime() > matchedJob.due_date) {
      result.warnings.push({
        field: "date",
        message: `Date is after job due date (${new Date(matchedJob.due_date).toLocaleDateString()})`,
      });
    }

    entryDate = dateObj.getTime();
  } else if (options.defaultDate) {
    // Use default date if provided
    const defaultDateObj =
      options.defaultDate instanceof Date
        ? options.defaultDate
        : new Date(options.defaultDate);
    entryDate = defaultDateObj.getTime();
  } else {
    // Use current date if no date provided
    entryDate = Date.now();
    result.warnings.push({
      field: "date",
      message: "No date provided, using current date",
    });
  }

  // 5. Check for duplicate entries
  if (options.checkDuplicates && options.existingEntries) {
    const duplicate = options.existingEntries.find(
      (entry) =>
        entry.job === matchedJob.id && isSameDay(entry.date, entryDate),
    );

    if (duplicate) {
      result.warnings.push({
        field: "duplicate",
        message: `Production entry already exists for this job on ${new Date(entryDate).toLocaleDateString()} (${duplicate.actual_quantity} units)`,
      });
    }
  }

  return result;
}

/**
 * Validates multiple Excel rows and returns validated rows ready for creation
 * @param rows - Array of parsed Excel rows
 * @param jobs - Array of all jobs
 * @param options - Validation options
 * @returns Array of validated rows with validation results
 */
export function validateProductionRows(
  rows: ParsedExcelRow[],
  jobs: ParsedJob[],
  options: ValidationOptions = {},
): ValidatedProductionRow[] {
  const validatedRows: ValidatedProductionRow[] = [];

  for (const row of rows) {
    const validation = validateProductionRow(row, jobs, options);

    const validatedRow: ValidatedProductionRow = {
      ...row,
      matchedJob: validation.matchedJob!,
      validation,
    };

    // Create production entry object if validation passed
    if (validation.isValid && validation.matchedJob) {
      let entryDate: number;

      if (row.date) {
        const dateObj =
          row.date instanceof Date ? row.date : new Date(row.date);
        entryDate = dateObj.getTime();
      } else if (options.defaultDate) {
        const defaultDateObj =
          options.defaultDate instanceof Date
            ? options.defaultDate
            : new Date(options.defaultDate);
        entryDate = defaultDateObj.getTime();
      } else {
        entryDate = Date.now();
      }

      validatedRow.productionEntry = {
        job: validation.matchedJob.id,
        date: entryDate,
        actual_quantity: row.quantity,
        notes: row.notes,
        facilities_id: validation.matchedJob.facilities_id,
      };
    }

    validatedRows.push(validatedRow);
  }

  return validatedRows;
}

/**
 * Finds a job by job number (handles both number and string formats)
 */
function findJobByJobNumber(
  jobNumber: number | string,
  jobs: ParsedJob[],
): ParsedJob | undefined {
  // Normalize job number to number for comparison
  const normalizedJobNumber =
    typeof jobNumber === "string" ? parseFloat(jobNumber) : jobNumber;

  if (isNaN(normalizedJobNumber)) {
    return undefined;
  }

  return jobs.find((job) => {
    // Compare as numbers (handles "00123" vs 123)
    return (
      job.job_number === normalizedJobNumber ||
      job.job_number === Math.floor(normalizedJobNumber)
    );
  });
}

/**
 * Checks if two timestamps are on the same day
 */
function isSameDay(date1: number, date2: number): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Gets summary statistics for validated rows
 */
export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  warnings: number;
  totalQuantity: number;
  facilitiesCount: Map<number, number>;
}

/**
 * Generates a summary of validation results
 */
export function getValidationSummary(
  validatedRows: ValidatedProductionRow[],
): ValidationSummary {
  const summary: ValidationSummary = {
    total: validatedRows.length,
    valid: 0,
    invalid: 0,
    warnings: 0,
    totalQuantity: 0,
    facilitiesCount: new Map(),
  };

  for (const row of validatedRows) {
    if (row.validation.isValid) {
      summary.valid++;
      summary.totalQuantity += row.quantity;

      // Count by facility
      if (row.matchedJob.facilities_id !== undefined) {
        const count =
          summary.facilitiesCount.get(row.matchedJob.facilities_id) || 0;
        summary.facilitiesCount.set(row.matchedJob.facilities_id, count + 1);
      }
    } else {
      summary.invalid++;
    }

    if (row.validation.warnings.length > 0) {
      summary.warnings++;
    }
  }

  return summary;
}
