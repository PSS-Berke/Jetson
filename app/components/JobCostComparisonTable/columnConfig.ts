// Sort field types for job cost comparison table
export type SortField =
  | "job_number"
  | "version"
  | "job_name"
  | "status"
  | "facility"
  | "client"
  | "sub_client"
  | "description"
  | "quantity"
  | "start_date"
  | "due_date"
  | "updated_at"
  | "billing_rate"
  | "actual_cost"
  | "profit_margin"
  | "profit_percentage"
  | "total_profit";

// Column types for unified handling
export type ColumnType =
  | "static"      // Regular data columns
  | "status"      // Status badge column
  | "editable"    // Editable columns (actual cost)
  | "currency"    // Currency formatted values
  | "percentage"  // Percentage formatted values
  | "profit";     // Profit with color coding

export interface JobCostColumnConfig {
  key: string;
  type: ColumnType;
  label: string;
  sortable: boolean;
  sortField?: SortField;
  width?: string;
  minWidth?: string;
  align?: "left" | "center" | "right";
  sticky?: "left" | "right";
  required?: boolean;        // Cannot be hidden
  reorderable?: boolean;     // Can be reordered via drag-drop (default true)
}

export const DEFAULT_COLUMNS: JobCostColumnConfig[] = [
  // Basic job columns
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
    key: "job_name",
    type: "static",
    label: "Job Name",
    sortable: true,
    sortField: "job_name",
    width: "150px",
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
  // Financial columns
  {
    key: "billing_rate",
    type: "currency",
    label: "Billing Rate",
    sortable: true,
    sortField: "billing_rate",
    align: "right",
    reorderable: true,
  },
  {
    key: "actual_cost",
    type: "editable",
    label: "Actual Cost",
    sortable: true,
    sortField: "actual_cost",
    align: "right",
    required: true,
    reorderable: false,
  },
  {
    key: "profit_margin",
    type: "profit",
    label: "Profit (per/M)",
    sortable: true,
    sortField: "profit_margin",
    align: "right",
    reorderable: true,
  },
  {
    key: "profit_percentage",
    type: "percentage",
    label: "Profit %",
    sortable: true,
    sortField: "profit_percentage",
    align: "right",
    reorderable: true,
  },
  {
    key: "total_profit",
    type: "profit",
    label: "Total Profit",
    sortable: true,
    sortField: "total_profit",
    align: "right",
    reorderable: true,
  },
];

// Get default column order (keys only)
export const getDefaultColumnOrder = (): string[] => {
  return DEFAULT_COLUMNS.map((col) => col.key);
};

// Get column config by key
export const getColumnByKey = (
  key: string
): JobCostColumnConfig | undefined => {
  return DEFAULT_COLUMNS.find((col) => col.key === key);
};

// Get all reorderable columns (for UI)
export const getReorderableColumns = (): JobCostColumnConfig[] => {
  return DEFAULT_COLUMNS.filter((col) => col.reorderable !== false);
};

// Get all columns that can be hidden (not required)
export const getToggleableColumns = (): JobCostColumnConfig[] => {
  return DEFAULT_COLUMNS.filter((col) => !col.required);
};

// localStorage key for persistence
export const COLUMN_SETTINGS_STORAGE_KEY = "job-cost-comparison-table-columns";
