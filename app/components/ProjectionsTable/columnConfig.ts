import { ReactNode } from "react";

// Sort field types (matching ProjectionsTable.tsx)
export type SortField =
  | "job_number"
  | "facility"
  | "sub_client"
  | "process_type"
  | "description"
  | "quantity"
  | "start_date"
  | "due_date"
  | "total";

// Column types for unified handling
export type ColumnType =
  | "static"      // Regular data columns (job_number, facility, etc.)
  | "checkbox"    // Selection checkbox
  | "time_range"  // Dynamic time period columns (placeholder - actual ranges are dynamic)
  | "total"       // Aggregation column
  | "notes";      // Notes column

export interface ProjectionColumnConfig {
  key: string;
  type: ColumnType;
  label: string;
  sortable: boolean;
  sortField?: SortField;
  width?: string;
  minWidth?: string;
  align?: "left" | "center" | "right";
  sticky?: "left" | "right";
  required?: boolean;        // Cannot be hidden (e.g., checkbox)
  reorderable?: boolean;     // Can be reordered via drag-drop (default true)
  externalControl?: string;  // Visibility controlled by external prop (e.g., "showNotes")
}

export const DEFAULT_COLUMNS: ProjectionColumnConfig[] = [
  {
    key: "checkbox",
    type: "checkbox",
    label: "",
    sortable: false,
    sticky: "left",
    width: "48px",
    required: true,
    reorderable: false,
  },
  {
    key: "job_number",
    type: "static",
    label: "Job #",
    sortable: true,
    sortField: "job_number",
    width: "80px",
    reorderable: true,
  },
  {
    key: "facility",
    type: "static",
    label: "Facility",
    sortable: true,
    sortField: "facility",
    reorderable: true,
  },
  {
    key: "sub_client",
    type: "static",
    label: "Sub Client",
    sortable: true,
    sortField: "sub_client",
    reorderable: true,
  },
  {
    key: "processes",
    type: "static",
    label: "Processes",
    sortable: false,
    reorderable: true,
  },
  {
    key: "description",
    type: "static",
    label: "Description",
    sortable: true,
    sortField: "description",
    width: "200px",
    reorderable: true,
  },
  {
    key: "quantity",
    type: "static",
    label: "Qty",
    sortable: true,
    sortField: "quantity",
    align: "center",
    reorderable: true,
  },
  {
    key: "start_date",
    type: "static",
    label: "Start",
    sortable: true,
    sortField: "start_date",
    align: "center",
    reorderable: true,
  },
  {
    key: "due_date",
    type: "static",
    label: "End",
    sortable: true,
    sortField: "due_date",
    align: "center",
    reorderable: true,
  },
  // Time period columns placeholder - actual ranges are dynamic
  {
    key: "time_ranges",
    type: "time_range",
    label: "Time Periods",
    sortable: false,
    required: true,
    reorderable: false,
  },
  {
    key: "total",
    type: "total",
    label: "Total",
    sortable: true,
    sortField: "total",
    sticky: "right",
    align: "center",
    reorderable: true,
  },
  {
    key: "notes",
    type: "notes",
    label: "Notes",
    sortable: false,
    minWidth: "200px",
    reorderable: false,
    externalControl: "showNotes", // Visibility controlled by showNotes prop
  },
];

// Get default column order (keys only)
export const getDefaultColumnOrder = (): string[] => {
  return DEFAULT_COLUMNS.map((col) => col.key);
};

// Get column config by key
export const getColumnByKey = (
  key: string
): ProjectionColumnConfig | undefined => {
  return DEFAULT_COLUMNS.find((col) => col.key === key);
};

// Get all reorderable columns (for UI)
export const getReorderableColumns = (): ProjectionColumnConfig[] => {
  return DEFAULT_COLUMNS.filter((col) => col.reorderable !== false);
};

// Get all columns that can be hidden (not required and no external control)
export const getToggleableColumns = (): ProjectionColumnConfig[] => {
  return DEFAULT_COLUMNS.filter(
    (col) => !col.required && !col.externalControl
  );
};

// localStorage key for persistence
export const COLUMN_SETTINGS_STORAGE_KEY = "projections-table-columns";
