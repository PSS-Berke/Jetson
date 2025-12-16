// Sort field types for inline job cost entry table
export type SortField =
  | "job_number"
  | "version"
  | "job_name"
  | "status"
  | "facility"
  | "client_name"
  | "sub_client"
  | "description"
  | "quantity"
  | "start_date"
  | "due_date"
  | "updated_at"
  | "billing_rate_per_m"
  | "current_cost_per_m"
  | "profit_percentage";

// Column types for unified handling
export type ColumnType =
  | "static"      // Regular data columns
  | "status"      // Status badge column
  | "editable"    // Editable columns (add_to_cost, set_total_cost, notes)
  | "currency"    // Currency formatted values
  | "percentage"  // Percentage formatted values
  | "profit";     // Profit with color coding

export interface InlineJobCostColumnConfig {
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
  batchModeOnly?: boolean;   // Only shown in batch mode
}

export const DEFAULT_COLUMNS: InlineJobCostColumnConfig[] = [
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
    key: "client_name",
    type: "static",
    label: "Client",
    sortable: true,
    sortField: "client_name",
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
    align: "right",
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
    key: "billing_rate_per_m",
    type: "currency",
    label: "Billing Rate (per/M)",
    sortable: true,
    sortField: "billing_rate_per_m",
    align: "right",
    reorderable: true,
  },
  {
    key: "current_cost_per_m",
    type: "currency",
    label: "Current Cost (per/M)",
    sortable: true,
    sortField: "current_cost_per_m",
    align: "right",
    reorderable: true,
  },
  // Batch mode editable columns
  {
    key: "add_to_cost",
    type: "editable",
    label: "Add to Cost",
    sortable: false,
    align: "center",
    reorderable: false,
    batchModeOnly: true,
  },
  {
    key: "set_total_cost",
    type: "editable",
    label: "Set Total Cost",
    sortable: false,
    align: "center",
    reorderable: false,
    batchModeOnly: true,
  },
  {
    key: "profit_preview",
    type: "profit",
    label: "New Profit %",
    sortable: false,
    align: "right",
    reorderable: false,
    batchModeOnly: true,
  },
  {
    key: "notes",
    type: "editable",
    label: "Notes",
    sortable: false,
    reorderable: false,
    batchModeOnly: true,
  },
  // Non-batch mode profit column
  {
    key: "profit_percentage",
    type: "profit",
    label: "Profit %",
    sortable: true,
    sortField: "profit_percentage",
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
): InlineJobCostColumnConfig | undefined => {
  return DEFAULT_COLUMNS.find((col) => col.key === key);
};

// Get all reorderable columns (for UI)
export const getReorderableColumns = (): InlineJobCostColumnConfig[] => {
  return DEFAULT_COLUMNS.filter((col) => col.reorderable !== false);
};

// Get all columns that can be hidden (not required)
export const getToggleableColumns = (): InlineJobCostColumnConfig[] => {
  return DEFAULT_COLUMNS.filter((col) => !col.required);
};

// localStorage key for persistence
export const COLUMN_SETTINGS_STORAGE_KEY = "inline-job-cost-entry-columns";
