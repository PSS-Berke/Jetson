/**
 * Central configuration for process types and their associated fields
 * This defines what fields should be displayed for each process type in job requirements
 */

export type FieldType = "text" | "number" | "dropdown" | "currency";

export interface FieldValidation {
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  validation?: FieldValidation;
  placeholder?: string;
}

export interface ProcessTypeConfig {
  key: string;
  label: string;
  color: string; // Hex color for badges and UI
  fields: FieldConfig[];
}

/**
 * Common paper sizes used across multiple process types
 */
export const COMMON_PAPER_SIZES = [
  "6x9",
  "6x12",
  "9x12",
  "10x13",
  "12x15",
  "#10",
  "11x17",
];

/**
 * Configuration for all process types
 * Each process type defines its own set of relevant fields
 */
export const PROCESS_TYPE_CONFIGS: ProcessTypeConfig[] = [
  {
    key: "data",
    label: "Data",
    color: "#14B8A6", // Teal
    fields: [],
  },
  {
    key: "hp",
    label: "HP",
    color: "#6366F1", // Indigo
    fields: [
      {
        name: "print_type",
        label: "Print Type",
        type: "dropdown",
        required: true,
        options: ["Simplex", "Duplex"],
      },
      {
        name: "paper_stock",
        label: "Paper Stock",
        type: "dropdown",
        required: true,
        options: [
          "80# Text",
          "100# Text",
          "80# Cover",
          "100# Cover",
          "12pt Cardstock",
        ],
      },
      {
        name: "paper_size",
        label: "Paper Size",
        type: "dropdown",
        required: true,
        options: ["12x18", "13x19", "Custom"],
      },
      {
        name: "color",
        label: "Color",
        type: "dropdown",
        required: false,
        options: ["Full Color"], // Fixed for HP Press
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: false,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "laser",
    label: "Laser",
    color: "#EF4444", // Red
    fields: [
      {
        name: "print_type",
        label: "Print Type",
        type: "dropdown",
        required: true,
        options: ["Simplex (1-sided)", "Duplex (2-sided)"],
      },
      {
        name: "paper_stock",
        label: "Paper Stock",
        type: "dropdown",
        required: true,
        options: ["20# Bond", "24# Bond", "60# Cover", "80# Cover"],
      },
      {
        name: "paper_size",
        label: "Paper Size",
        type: "dropdown",
        required: true,
        options: ["Letter", "Legal", "Tabloid", "11x17"],
      },
      {
        name: "color",
        label: "Color",
        type: "dropdown",
        required: true,
        options: ["Black & White", "Full Color"],
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: false,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "fold",
    label: "Fold",
    color: "#EC4899", // Pink
    fields: [
      {
        name: "fold_type",
        label: "Fold Type",
        type: "dropdown",
        required: true,
        options: [
          "Half Fold",
          "Tri-fold",
          "Z-fold",
          "Double Parallel",
          "Roll Fold",
        ],
      },
      {
        name: "paper_stock",
        label: "Paper Stock",
        type: "dropdown",
        required: true,
        options: [
          "20# Bond",
          "24# Bond",
          "60# Text",
          "80# Text",
          "100# Text",
          "Cardstock",
        ],
      },
      {
        name: "paper_size",
        label: "Paper Size",
        type: "dropdown",
        required: true,
        options: ["8.5x11", "8.5x14", "11x17", "12x18", "Custom"],
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: false,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "affix",
    label: "Affix with Glue",
    color: "#F59E0B", // Orange
    fields: [
      {
        name: "application_type",
        label: "Application Type",
        type: "dropdown",
        required: true,
        options: ["Label Application", "Affix", "Wafer Seal"],
      },
      {
        name: "label_size",
        label: "Label Size",
        type: "dropdown",
        required: true,
        options: ["1x2.625", "2x3", "3x5", "4x6", "Custom"],
      },
      {
        name: "paper_size",
        label: "Paper Size (Base Mailpiece)",
        type: "dropdown",
        required: true,
        options: COMMON_PAPER_SIZES,
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: false,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "insert",
    label: "Insert",
    color: "#3B82F6", // Blue
    fields: [
      {
        name: "paper_size",
        label: "Paper Size",
        type: "dropdown",
        required: true,
        options: COMMON_PAPER_SIZES,
      },
      {
        name: "pockets",
        label: "Number of Pockets/Inserts",
        type: "number",
        required: false,
        validation: {
          min: 0,
          max: 12,
          step: 1,
        },
        placeholder: "0",
      },
      {
        name: "sort_type",
        label: "Sort",
        type: "dropdown",
        required: false,
        options: ["TRUE", "FALSE"],
      },
      {
        name: "read_write",
        label: "Read Write",
        type: "text",
        required: false,
      },
      {
        name: "affix",
        label: "Affix",
        type: "text",
        required: false,
      },
      {
        name: "glue_closed",
        label: "Glue Closed",
        type: "text",
        required: false,
      },
      {
        name: "stamps",
        label: "Stamps",
        type: "text",
        required: false,
      },
      {
        name: "label_size",
        label: "Label Size",
        type: "text",
        required: false,
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: false,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "inkjet",
    label: "Ink Jet",
    color: "#8B5CF6", // Purple
    fields: [
      {
        name: "print_type",
        label: "Print Type",
        type: "dropdown",
        required: true,
        options: ["Simplex", "Duplex"],
      },
      {
        name: "paper_size",
        label: "Paper Size",
        type: "dropdown",
        required: true,
        options: COMMON_PAPER_SIZES,
      },
      {
        name: "color",
        label: "Color",
        type: "dropdown",
        required: false,
        options: ["Black & White", "Full Color"],
      },
      {
        name: "num_addresses",
        label: "Number of Addresses",
        type: "number",
        required: false,
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: false,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "labeling",
    label: "Labeling",
    color: "#10B981", // Green
    fields: [
      {
        name: "label_size",
        label: "Label Size",
        type: "dropdown",
        required: true,
        options: ["1x2.625", "2x3", "3x5", "4x6", "Custom"],
      },
      {
        name: "paper_size",
        label: "Paper Size (Base Mailpiece)",
        type: "dropdown",
        required: true,
        options: COMMON_PAPER_SIZES,
      },
      {
        name: "label_type",
        label: "Label Type",
        type: "dropdown",
        required: false,
        options: ["Address Label", "Barcode", "Custom"],
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: false,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
];

/**
 * Get configuration for a specific process type
 */
export function getProcessTypeConfig(
  processTypeKey: string,
): ProcessTypeConfig | undefined {
  return PROCESS_TYPE_CONFIGS.find((config) => config.key === processTypeKey);
}

/**
 * Get all process type keys
 */
export function getAllProcessTypeKeys(): string[] {
  return PROCESS_TYPE_CONFIGS.map((config) => config.key);
}

/**
 * Get all process types as options for dropdown
 * These values use normalized keys to ensure consistency with database
 * Uses labels from PROCESS_TYPE_CONFIGS to ensure consistency
 */
export function getProcessTypeOptions(): Array<{
  value: string;
  label: string;
}> {
  // Map from PROCESS_TYPE_CONFIGS to ensure labels match exactly
  const options = PROCESS_TYPE_CONFIGS.map((config) => ({
    value: config.key,
    label: config.label,
  }));

  // Add Capability Bucket (not in configs but used in some contexts)
  options.push({ value: "Capability Bucket", label: "Capability Bucket" });

  return options;
}

/**
 * Get color for a process type
 */
export function getProcessTypeColor(processTypeKey: string): string {
  const config = getProcessTypeConfig(processTypeKey);
  return config?.color || "#6B7280"; // Gray as fallback
}

/**
 * Map normalized process types to their source types in the database
 * This ensures both the Machines page and job creation use the same records
 */
export function getSourceTypesForProcessType(normalizedType: string): string[] {
  const sourceTypesMap: Record<string, string[]> = {
    'insert': ['Insert'],
    'affix': ['Affix glue+', 'Affix label+'],
    'hp': ['HP Press'],
    'laser': ['Laser'],
    'data': ['Data'],
    'fold': ['Fold', 'fold'],
    'inkjet': ['Ink jet+'],
    'labeling': ['Label/Apply'],
  };

  return sourceTypesMap[normalizedType] || [normalizedType];
}

/**
 * Normalize process type variations to standard keys
 * Handles backward compatibility for deprecated process types
 */
export function normalizeProcessType(processType: string): string {
  const normalized = processType.toLowerCase().trim();

  // Filter out deprecated types - return the original value so they can be filtered elsewhere
  const deprecatedTypes = ['9-12 in+', 'sort', 'insert +', 'insert+', '13+ in+', '13+'];
  if (deprecatedTypes.includes(normalized)) {
    return normalized; // Return as-is to be filtered by DEPRECATED_TYPES check
  }

  // "Affix" variants with glue -> "affix"
  if (
    normalized === "affixglue" ||
    normalized === "affix glue+" ||
    normalized === "affixlabel" ||
    normalized === "affix label+" ||
    normalized === "affix with glue"
  ) {
    return "affix";
  }

  // "Label/Apply" variants -> "labeling"
  if (
    normalized === "labelapply" ||
    normalized === "label/apply" ||
    normalized === "label apply" ||
    normalized === "labeling"
  ) {
    return "labeling";
  }

  // "HP Press" -> "hp"
  if (
    normalized === "hppress" ||
    normalized === "hp press" ||
    (normalized.includes("hp") && normalized.includes("press"))
  ) {
    return "hp";
  }

  // Inkjet variants -> "inkjet" (now a separate process type)
  if (
    normalized === "inkjetplus" ||
    normalized === "ink jet+" ||
    normalized === "inkjet" ||
    normalized === "ij" ||
    normalized === "ink jet"
  ) {
    return "inkjet";
  }

  // Handle common variations for current types
  if (
    normalized.includes("label") ||
    normalized === "l/a"
  ) {
    return "labeling";
  }

  if (normalized.includes("affix")) {
    return "affix";
  }

  // Fold variants -> "fold"
  if (normalized === "fold" || normalized === "folding") {
    return "fold";
  }

  // Check if it matches any standard key
  const matchingConfig = PROCESS_TYPE_CONFIGS.find(
    (config) =>
      config.key === normalized || config.label.toLowerCase() === normalized,
  );

  return matchingConfig?.key || normalized;
}

/**
 * Get dynamic fields that can be used for breakdown grouping
 * Excludes currency fields (price_per_m) and includes fields suitable for categorization
 *
 * @param processTypeKey - Normalized process type key (e.g., "insert", "laser")
 * @param machineVariables - Optional machine variables from API (contains dynamic fields)
 * @returns Array of field definitions suitable for breakdown grouping
 */
export function getBreakdownableFields(
  processTypeKey: string,
  machineVariables?: {
    type: string;
    variables: Record<
      string,
      {
        type: string;
        label: string;
        addToJobInput?: boolean;
        showInAdditionalFields?: boolean;
      }
    >;
  }[],
): Array<{ name: string; label: string; type: FieldType | "boolean" }> {
  const normalizedKey = normalizeProcessType(processTypeKey);
  const fields: Array<{ name: string; label: string; type: FieldType | "boolean" }> = [];

  // Get static fields from process type config
  const config = getProcessTypeConfig(normalizedKey);
  if (config) {
    config.fields.forEach((field) => {
      // Exclude currency fields
      if (field.type !== "currency") {
        fields.push({
          name: field.name,
          label: field.label,
          type: field.type,
        });
      }
    });
  }

  // Add dynamic fields from machine variables if available
  if (machineVariables) {
    const matchingVariables = machineVariables.find((mv) => {
      const mvNormalized = normalizeProcessType(mv.type);
      return mvNormalized === normalizedKey;
    });

    if (matchingVariables) {
      Object.entries(matchingVariables.variables).forEach(([fieldName, fieldDef]) => {
        // Only include fields that are used in job input and not already in static fields
        if (fieldDef.addToJobInput && !fields.find((f) => f.name === fieldName)) {
          // Exclude currency fields
          if (fieldDef.type !== "currency") {
            fields.push({
              name: fieldName,
              label: fieldDef.label,
              type: fieldDef.type as FieldType | "boolean",
            });
          }
        }
      });
    }
  }

  return fields;
}
