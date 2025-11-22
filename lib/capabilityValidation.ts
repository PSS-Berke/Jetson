/**
 * Capability validation functions
 * Ensures machine capabilities are valid for their process type
 */

import {
  MachineCapabilityValue,
  InsertCapabilities,
  SortCapabilities,
  LabelApplyCapabilities,
  FoldCapabilities,
  LaserCapabilities,
  HpPressCapabilities,
} from "@/types";
import { PROCESS_TYPE_CONFIGS, COMMON_PAPER_SIZES } from "./processTypeConfig";

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// Reserved Field Names (Standard Process Type Fields)
// ============================================================================

const RESERVED_FIELD_NAMES = new Set([
  // Common fields
  "price_per_m",
  // Insert fields
  "supported_paper_sizes",
  "min_pockets",
  "max_pockets",
  "paper_size",
  "pockets",
  // Sort fields
  "supported_sort_types",
  "sort_type",
  // Label/Apply fields
  "supported_application_types",
  "supported_label_sizes",
  "application_type",
  "label_size",
  // Fold fields
  "supported_fold_types",
  "supported_paper_stocks",
  "fold_type",
  "paper_stock",
  // Laser/HP Press fields
  "supported_print_types",
  "supported_colors",
  "print_type",
  "color",
]);

// ============================================================================
// Field Name Validation
// ============================================================================

/**
 * Check if a custom field name conflicts with reserved names
 */
export function isReservedFieldName(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().trim();
  return RESERVED_FIELD_NAMES.has(normalized);
}

/**
 * Check if a custom field name is properly namespaced
 */
export function isProperlyNamespaced(fieldName: string): boolean {
  return fieldName.startsWith("custom_") || fieldName.startsWith("fb_");
}

/**
 * Suggest a properly namespaced field name
 */
export function suggestNamespacedFieldName(fieldName: string): string {
  if (isProperlyNamespaced(fieldName)) {
    return fieldName;
  }
  // Convert to snake_case and add prefix
  const snakeCase = fieldName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return `custom_${snakeCase}`;
}

/**
 * Validate a custom field name
 */
export function validateFieldName(fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check if empty
  if (!fieldName || fieldName.trim() === "") {
    errors.push({
      field: "fieldName",
      message: "Field name cannot be empty",
      severity: "error",
    });
  }

  // Check if reserved
  if (isReservedFieldName(fieldName) && !isProperlyNamespaced(fieldName)) {
    errors.push({
      field: fieldName,
      message: `"${fieldName}" is a reserved field name. Custom fields must be prefixed with "custom_" or "fb_". Try: "${suggestNamespacedFieldName(fieldName)}"`,
      severity: "error",
    });
  }

  // Check if properly namespaced
  if (!isProperlyNamespaced(fieldName)) {
    warnings.push({
      field: fieldName,
      message: `Custom field "${fieldName}" should be prefixed with "custom_" to avoid conflicts. Suggested: "${suggestNamespacedFieldName(fieldName)}"`,
      severity: "warning",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Value Validation
// ============================================================================

/**
 * Validate that a value is a valid number
 */
function validateNumber(
  field: string,
  value: any,
  options?: { min?: number; max?: number; allowDecimals?: boolean }
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null || value === "") {
    return errors; // Optional field, no validation needed
  }

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) {
    errors.push({
      field,
      message: `${field} must be a valid number`,
      severity: "error",
    });
    return errors;
  }

  if (options?.allowDecimals === false && num % 1 !== 0) {
    errors.push({
      field,
      message: `${field} must be a whole number`,
      severity: "error",
    });
  }

  if (options?.min !== undefined && num < options.min) {
    errors.push({
      field,
      message: `${field} must be at least ${options.min}`,
      severity: "error",
    });
  }

  if (options?.max !== undefined && num > options.max) {
    errors.push({
      field,
      message: `${field} must be at most ${options.max}`,
      severity: "error",
    });
  }

  return errors;
}

/**
 * Validate that a value is in an allowed list
 */
function validateEnum(
  field: string,
  value: any,
  allowedValues: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null || value === "") {
    return errors; // Optional field
  }

  if (!allowedValues.includes(value)) {
    errors.push({
      field,
      message: `${field} must be one of: ${allowedValues.join(", ")}`,
      severity: "error",
    });
  }

  return errors;
}

/**
 * Validate that a value is an array of allowed values
 */
function validateArrayEnum(
  field: string,
  value: any,
  allowedValues: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null) {
    return errors; // Optional field
  }

  if (!Array.isArray(value)) {
    errors.push({
      field,
      message: `${field} must be an array`,
      severity: "error",
    });
    return errors;
  }

  // Check each item in array
  const invalidItems = value.filter((item) => !allowedValues.includes(item));
  if (invalidItems.length > 0) {
    errors.push({
      field,
      message: `${field} contains invalid values: ${invalidItems.join(", ")}. Allowed values: ${allowedValues.join(", ")}`,
      severity: "error",
    });
  }

  return errors;
}

/**
 * Validate min/max range fields
 */
function validateMinMaxRange(
  minField: string,
  maxField: string,
  capabilities: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const minValue = capabilities[minField];
  const maxValue = capabilities[maxField];

  // If both are present, validate that min <= max
  if (
    minValue !== undefined &&
    minValue !== null &&
    maxValue !== undefined &&
    maxValue !== null
  ) {
    const min = typeof minValue === "string" ? parseFloat(minValue) : minValue;
    const max = typeof maxValue === "string" ? parseFloat(maxValue) : maxValue;

    if (!isNaN(min) && !isNaN(max) && min > max) {
      errors.push({
        field: minField,
        message: `${minField} (${min}) cannot be greater than ${maxField} (${max})`,
        severity: "error",
      });
    }
  }

  return errors;
}

// ============================================================================
// Process Type Specific Validation
// ============================================================================

/**
 * Validate Insert machine capabilities
 */
function validateInsertCapabilities(
  capabilities: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate supported_paper_sizes
  if (capabilities.supported_paper_sizes !== undefined) {
    errors.push(
      ...validateArrayEnum(
        "supported_paper_sizes",
        capabilities.supported_paper_sizes,
        COMMON_PAPER_SIZES
      )
    );
  }

  // Validate min_pockets and max_pockets
  errors.push(
    ...validateNumber("min_pockets", capabilities.min_pockets, {
      min: 0,
      max: 12,
      allowDecimals: false,
    })
  );
  errors.push(
    ...validateNumber("max_pockets", capabilities.max_pockets, {
      min: 0,
      max: 12,
      allowDecimals: false,
    })
  );

  // Validate min <= max
  errors.push(
    ...validateMinMaxRange("min_pockets", "max_pockets", capabilities)
  );

  // Validate price_per_m
  errors.push(
    ...validateNumber("price_per_m", capabilities.price_per_m, { min: 0 })
  );

  return errors;
}

/**
 * Validate Sort machine capabilities
 */
function validateSortCapabilities(
  capabilities: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const allowedSortTypes = [
    "Standard Sort",
    "Presort",
    "EDDM",
    "Full Service",
  ];

  errors.push(
    ...validateArrayEnum(
      "supported_sort_types",
      capabilities.supported_sort_types,
      allowedSortTypes
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_paper_sizes",
      capabilities.supported_paper_sizes,
      COMMON_PAPER_SIZES
    )
  );

  errors.push(
    ...validateNumber("price_per_m", capabilities.price_per_m, { min: 0 })
  );

  return errors;
}

/**
 * Validate Label/Apply machine capabilities
 */
function validateLabelApplyCapabilities(
  capabilities: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const allowedApplicationTypes = [
    "Label Application",
    "Affix",
    "Wafer Seal",
  ];
  const allowedLabelSizes = ["1x2.625", "2x3", "3x5", "4x6", "Custom"];

  errors.push(
    ...validateArrayEnum(
      "supported_application_types",
      capabilities.supported_application_types,
      allowedApplicationTypes
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_label_sizes",
      capabilities.supported_label_sizes,
      allowedLabelSizes
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_paper_sizes",
      capabilities.supported_paper_sizes,
      COMMON_PAPER_SIZES
    )
  );

  errors.push(
    ...validateNumber("price_per_m", capabilities.price_per_m, { min: 0 })
  );

  return errors;
}

/**
 * Validate Fold machine capabilities
 */
function validateFoldCapabilities(
  capabilities: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const allowedFoldTypes = [
    "Half Fold",
    "Tri-fold",
    "Z-fold",
    "Double Parallel",
    "Roll Fold",
  ];
  const allowedPaperStocks = [
    "20# Bond",
    "24# Bond",
    "60# Text",
    "80# Text",
    "100# Text",
    "Cardstock",
  ];
  const allowedPaperSizes = ["8.5x11", "8.5x14", "11x17", "12x18", "Custom"];

  errors.push(
    ...validateArrayEnum(
      "supported_fold_types",
      capabilities.supported_fold_types,
      allowedFoldTypes
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_paper_stocks",
      capabilities.supported_paper_stocks,
      allowedPaperStocks
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_paper_sizes",
      capabilities.supported_paper_sizes,
      allowedPaperSizes
    )
  );

  errors.push(
    ...validateNumber("price_per_m", capabilities.price_per_m, { min: 0 })
  );

  return errors;
}

/**
 * Validate Laser machine capabilities
 */
function validateLaserCapabilities(
  capabilities: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const allowedPrintTypes = ["Simplex (1-sided)", "Duplex (2-sided)"];
  const allowedPaperStocks = ["20# Bond", "24# Bond", "60# Cover", "80# Cover"];
  const allowedPaperSizes = ["Letter", "Legal", "Tabloid", "11x17"];
  const allowedColors = ["Black & White", "Full Color"];

  errors.push(
    ...validateArrayEnum(
      "supported_print_types",
      capabilities.supported_print_types,
      allowedPrintTypes
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_paper_stocks",
      capabilities.supported_paper_stocks,
      allowedPaperStocks
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_paper_sizes",
      capabilities.supported_paper_sizes,
      allowedPaperSizes
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_colors",
      capabilities.supported_colors,
      allowedColors
    )
  );

  errors.push(
    ...validateNumber("price_per_m", capabilities.price_per_m, { min: 0 })
  );

  return errors;
}

/**
 * Validate HP Press machine capabilities
 */
function validateHpPressCapabilities(
  capabilities: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const allowedPrintTypes = ["Simplex", "Duplex"];
  const allowedPaperStocks = [
    "80# Text",
    "100# Text",
    "80# Cover",
    "100# Cover",
    "12pt Cardstock",
  ];
  const allowedPaperSizes = ["12x18", "13x19", "Custom"];
  const allowedColors = ["Full Color"];

  errors.push(
    ...validateArrayEnum(
      "supported_print_types",
      capabilities.supported_print_types,
      allowedPrintTypes
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_paper_stocks",
      capabilities.supported_paper_stocks,
      allowedPaperStocks
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_paper_sizes",
      capabilities.supported_paper_sizes,
      allowedPaperSizes
    )
  );

  errors.push(
    ...validateArrayEnum(
      "supported_colors",
      capabilities.supported_colors,
      allowedColors
    )
  );

  errors.push(
    ...validateNumber("price_per_m", capabilities.price_per_m, { min: 0 })
  );

  return errors;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate machine capabilities for a specific process type
 */
export function validateCapabilities(
  processTypeKey: string,
  capabilities: Record<string, MachineCapabilityValue>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Normalize process type key
  const normalizedKey = processTypeKey.toLowerCase().trim();

  // Validate based on process type
  switch (normalizedKey) {
    case "insert":
    case "insertplus":
    case "insert+":
    case "insert9to12":
    case "9-12 in+":
    case "insert13plus":
    case "13+ in+":
      errors.push(...validateInsertCapabilities(capabilities));
      break;

    case "sort":
      errors.push(...validateSortCapabilities(capabilities));
      break;

    case "labelapply":
    case "label/apply":
    case "affixglue":
    case "affix glue+":
    case "affixlabel":
    case "affix label+":
      errors.push(...validateLabelApplyCapabilities(capabilities));
      break;

    case "fold":
      errors.push(...validateFoldCapabilities(capabilities));
      break;

    case "laser":
      errors.push(...validateLaserCapabilities(capabilities));
      break;

    case "hppress":
    case "hp press":
      errors.push(...validateHpPressCapabilities(capabilities));
      break;

    case "data":
    case "inkjetplus":
    case "ink jet+":
      // No specific validation for these types yet
      break;

    default:
      warnings.push({
        field: "process_type_key",
        message: `Unknown process type: ${processTypeKey}. Skipping type-specific validation.`,
        severity: "warning",
      });
  }

  // Validate custom field names
  Object.keys(capabilities).forEach((fieldName) => {
    // Skip reserved fields
    if (isReservedFieldName(fieldName)) {
      return;
    }

    // Check if custom field is properly namespaced
    const fieldValidation = validateFieldName(fieldName);
    errors.push(...fieldValidation.errors);
    warnings.push(...fieldValidation.warnings);
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get a human-readable error message from validation result
 */
export function getValidationErrorMessage(result: ValidationResult): string {
  if (result.valid) {
    return "";
  }

  const errorMessages = result.errors.map((e) => e.message);
  return errorMessages.join("; ");
}

/**
 * Get all error and warning messages
 */
export function getAllValidationMessages(result: ValidationResult): string[] {
  return [
    ...result.errors.map((e) => `❌ ${e.message}`),
    ...result.warnings.map((w) => `⚠️ ${w.message}`),
  ];
}
