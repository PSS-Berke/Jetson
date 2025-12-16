// Shared column configuration types and basic columns for all tables
// This provides a unified system for column visibility, ordering, and rendering

// Unified column types across all tables
export type BaseColumnType =
  | "static"      // Regular read-only data columns
  | "checkbox"    // Selection checkbox
  | "status"      // Status badge (schedule type)
  | "editable"    // Inline editable cells
  | "time_range"  // Dynamic time period columns
  | "total"       // Aggregation/sum columns
  | "notes"       // Notes with editing
  | "variance"    // Variance display with color coding
  | "currency"    // Currency formatted values
  | "percentage"; // Percentage formatted values

// Base column config interface that all tables can extend
export interface BaseColumnConfig {
  key: string;
  type: BaseColumnType;
  label: string;
  sortable: boolean;
  sortField?: string;
  width?: string;
  minWidth?: string;
  align?: "left" | "center" | "right";
  sticky?: "left" | "right";
  required?: boolean;        // Cannot be hidden
  reorderable?: boolean;     // Can be reordered via drag-drop (default true)
  externalControl?: string;  // Controlled by external toggle (e.g., processes)
}

// Standard "basic columns" that all job-related tables should have
// These represent the core job information fields
export const BASIC_JOB_COLUMNS: BaseColumnConfig[] = [
  {
    key: "job_number",
    type: "static",
    label: "Job #",
    sortable: true,
    sortField: "job_number",
    width: "80px",
    sticky: "left",
    required: true,
    reorderable: false,
  },
  {
    key: "version",
    type: "static",
    label: "Version",
    sortable: true,
    sortField: "version",
    width: "70px",
    align: "center",
    reorderable: true,
  },
  {
    key: "status",
    type: "status",
    label: "Status",
    sortable: true,
    sortField: "status",
    align: "center",
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
    key: "client",
    type: "static",
    label: "Client",
    sortable: true,
    sortField: "client",
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
  {
    key: "updated_at",
    type: "static",
    label: "Modified",
    sortable: true,
    sortField: "updated_at",
    align: "center",
    reorderable: true,
  },
];

// Helper to get a basic column by key
export const getBasicColumnByKey = (key: string): BaseColumnConfig | undefined => {
  return BASIC_JOB_COLUMNS.find((col) => col.key === key);
};

// Helper to get basic column keys
export const getBasicColumnKeys = (): string[] => {
  return BASIC_JOB_COLUMNS.map((col) => col.key);
};

// Status priority for sorting (lower = higher priority)
export const STATUS_SORT_PRIORITY: Record<string, number> = {
  "hard": 1,
  "soft": 2,
  "projected": 3,
  "complete": 4,
  "cancel": 5,
};

// Get status priority for sorting
export const getStatusPriority = (scheduleType: string | undefined | null): number => {
  const statusLower = (scheduleType || "soft schedule").toLowerCase();
  if (statusLower.includes("hard")) return STATUS_SORT_PRIORITY.hard;
  if (statusLower.includes("soft")) return STATUS_SORT_PRIORITY.soft;
  if (statusLower.includes("projected")) return STATUS_SORT_PRIORITY.projected;
  if (statusLower.includes("complete")) return STATUS_SORT_PRIORITY.complete;
  if (statusLower.includes("cancel")) return STATUS_SORT_PRIORITY.cancel;
  return STATUS_SORT_PRIORITY.soft; // Default to soft
};

// Status display configuration
export interface StatusDisplayConfig {
  className: string;
  label: string;
}

// Get status display configuration (colors and label)
export const getStatusDisplay = (scheduleType: string | undefined | null): StatusDisplayConfig => {
  const statusLower = (scheduleType || "soft schedule").toLowerCase();

  if (statusLower.includes("hard")) {
    return { className: "bg-green-100 text-green-800", label: "Hard" };
  }
  if (statusLower.includes("cancel")) {
    return { className: "bg-red-100 text-red-800", label: "Cancelled" };
  }
  if (statusLower.includes("complete")) {
    return { className: "bg-purple-100 text-purple-800", label: "Completed" };
  }
  if (statusLower.includes("projected")) {
    return { className: "bg-blue-100 text-blue-800", label: "Projected" };
  }
  // Default: soft schedule
  return { className: "bg-yellow-100 text-yellow-800", label: "Soft" };
};

// Column settings storage key prefix
export const COLUMN_SETTINGS_PREFIX = "table-column-settings-";

// Get localStorage key for a specific table
export const getColumnSettingsKey = (tableId: string): string => {
  return `${COLUMN_SETTINGS_PREFIX}${tableId}`;
};

// Column settings interface for persistence
export interface ColumnSettings {
  order: string[];
  hidden: string[];
}

// Default column settings
export const getDefaultColumnSettings = (columns: BaseColumnConfig[]): ColumnSettings => {
  return {
    order: columns.map((col) => col.key),
    hidden: [],
  };
};
