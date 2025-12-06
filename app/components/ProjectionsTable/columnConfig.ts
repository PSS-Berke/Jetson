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

export interface ProjectionColumnConfig {
  key: string;
  label: string;
  sortable: boolean;
  sortField?: SortField;
  width?: string;
  minWidth?: string;
  align?: "left" | "center" | "right";
  sticky?: "left" | "right";
  required?: boolean; // Cannot be hidden (e.g., checkbox)
}

export const DEFAULT_COLUMNS: ProjectionColumnConfig[] = [
  {
    key: "checkbox",
    label: "",
    sortable: false,
    sticky: "left",
    width: "48px",
    required: true,
  },
  {
    key: "job_number",
    label: "Job #",
    sortable: true,
    sortField: "job_number",
    width: "80px",
  },
  {
    key: "facility",
    label: "Facility",
    sortable: true,
    sortField: "facility",
  },
  {
    key: "sub_client",
    label: "Sub Client",
    sortable: true,
    sortField: "sub_client",
  },
  {
    key: "processes",
    label: "Processes",
    sortable: false,
  },
  {
    key: "description",
    label: "Description",
    sortable: true,
    sortField: "description",
    width: "200px",
  },
  {
    key: "quantity",
    label: "Qty",
    sortable: true,
    sortField: "quantity",
    align: "center",
  },
  {
    key: "start_date",
    label: "Start",
    sortable: true,
    sortField: "start_date",
    align: "center",
  },
  {
    key: "due_date",
    label: "End",
    sortable: true,
    sortField: "due_date",
    align: "center",
  },
  // Time period columns are inserted dynamically between due_date and total
  {
    key: "total",
    label: "Total",
    sortable: true,
    sortField: "total",
    sticky: "right",
    align: "right",
  },
  {
    key: "notes",
    label: "Notes",
    sortable: false,
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

// localStorage key for persistence
export const COLUMN_SETTINGS_STORAGE_KEY = "projections-table-columns";
