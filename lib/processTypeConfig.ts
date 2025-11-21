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
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: true,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "sort",
    label: "Sort",
    color: "#8B5CF6", // Purple
    fields: [
      {
        name: "sort_type",
        label: "Sort Type",
        type: "dropdown",
        required: true,
        options: ["Standard Sort", "Presort", "EDDM", "Full Service"],
      },
      {
        name: "paper_size",
        label: "Paper Size",
        type: "dropdown",
        required: true,
        options: COMMON_PAPER_SIZES,
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: true,
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
    label: "Inkjet",
    color: "#10B981", // Green
    fields: [
      {
        name: "print_coverage",
        label: "Print Coverage",
        type: "dropdown",
        required: true,
        options: ["Black & White", "Full Color", "Spot Color"],
      },
      {
        name: "paper_size",
        label: "Paper Size",
        type: "dropdown",
        required: true,
        options: COMMON_PAPER_SIZES,
      },
      {
        name: "num_addresses",
        label: "Number of Addresses",
        type: "number",
        required: false,
        validation: {
          min: 0,
          step: 1,
        },
        placeholder: "0",
      },
      {
        name: "price_per_m",
        label: "Price (per/m)",
        type: "currency",
        required: true,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "labelApply",
    label: "Label/Apply",
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
        required: true,
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
        required: true,
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
        required: true,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "hpPress",
    label: "HP Press",
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
        required: true,
        validation: {
          min: 0,
          step: 0.01,
        },
        placeholder: "0.00",
      },
    ],
  },
  {
    key: "data",
    label: "Data",
    color: "#14B8A6", // Teal
    fields: [],
  },
  {
    key: "affixGlue",
    label: "Affix glue+",
    color: "#F59E0B", // Orange (maps to labelApply)
    fields: [],
  },
  {
    key: "affixLabel",
    label: "Affix label+",
    color: "#F59E0B", // Orange (maps to labelApply)
    fields: [],
  },
  {
    key: "insertPlus",
    label: "Insert+",
    color: "#3B82F6", // Blue (maps to insert)
    fields: [],
  },
  {
    key: "insert9to12",
    label: "9-12 in+",
    color: "#3B82F6", // Blue (maps to insert)
    fields: [],
  },
  {
    key: "insert13Plus",
    label: "13+ in+",
    color: "#3B82F6", // Blue (maps to insert)
    fields: [],
  },
  {
    key: "inkjetPlus",
    label: "Ink jet+",
    color: "#10B981", // Green (maps to inkjet)
    fields: [],
  },
  {
    key: "sortAlt",
    label: "Sort",
    color: "#3B82F6", // Blue (maps to insert per your spec)
    fields: [],
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
 */
export function getProcessTypeOptions(): Array<{
  value: string;
  label: string;
}> {
  return PROCESS_TYPE_CONFIGS.map((config) => ({
    value: config.key,
    label: config.label,
  }));
}

/**
 * Get color for a process type
 */
export function getProcessTypeColor(processTypeKey: string): string {
  const config = getProcessTypeConfig(processTypeKey);
  return config?.color || "#6B7280"; // Gray as fallback
}

/**
 * Normalize process type variations to standard keys
 */
export function normalizeProcessType(processType: string): string {
  const normalized = processType.toLowerCase().trim();

  // Handle new alias mappings
  if (normalized === "affixglue" || normalized === "affix glue+") {
    return "labelApply";
  }
  if (normalized === "affixlabel" || normalized === "affix label+") {
    return "labelApply";
  }
  if (normalized === "insertplus" || normalized === "insert+") {
    return "insert";
  }
  if (normalized === "insert9to12" || normalized === "9-12 in+" || normalized === "9-12 in+") {
    return "insert";
  }
  if (normalized === "insert13plus" || normalized === "13+ in+" || normalized === "13+ in+") {
    return "insert";
  }
  if (normalized === "inkjetplus" || normalized === "ink jet+") {
    return "inkjet";
  }
  if (normalized === "sortalt" || (normalized === "sort" && processType !== "Sort")) {
    return "insert";
  }

  // Handle common variations
  if (
    normalized.includes("inkjet") ||
    normalized === "ij" ||
    normalized === "ink jet"
  ) {
    return "inkjet";
  }
  if (
    normalized.includes("label") ||
    normalized === "l/a" ||
    normalized.includes("affix")
  ) {
    return "labelApply";
  }
  if (normalized.includes("hp") && normalized.includes("press")) {
    return "hpPress";
  }

  // Check if it matches any standard key
  const matchingConfig = PROCESS_TYPE_CONFIGS.find(
    (config) =>
      config.key === normalized || config.label.toLowerCase() === normalized,
  );

  return matchingConfig?.key || normalized;
}
