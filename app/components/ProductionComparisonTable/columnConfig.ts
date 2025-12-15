// Sort field types for production comparison table
export type SortField =
  | "job_number"
  | "version"
  | "job_name"
  | "facility"
  | "client"
  | "sub_client"
  | "description"
  | "quantity"
  | "start_date"
  | "due_date"
  | "date_entered"
  | "projected"
  | "actual"
  | "variance"
  | "status";

// Column types for unified handling
export type ColumnType =
  | "static"     // Regular data columns
  | "editable"   // Editable columns (actual)
  | "variance"   // Variance display columns
  | "status";    // Status badge column

export interface ProductionColumnConfig {
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

export const DEFAULT_COLUMNS: ProductionColumnConfig[] = [
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
    sortField: "date_entered",
    align: "center",
    reorderable: true,
  },
  {
    key: "projected",
    type: "static",
    label: "Projected",
    sortable: true,
    sortField: "projected",
    align: "right",
    reorderable: true,
  },
  {
    key: "actual",
    type: "editable",
    label: "Actual",
    sortable: true,
    sortField: "actual",
    align: "right",
    required: true,
    reorderable: false,
  },
  {
    key: "variance",
    type: "variance",
    label: "Variance",
    sortable: true,
    sortField: "variance",
    align: "right",
    reorderable: true,
  },
  {
    key: "variance_pct",
    type: "variance",
    label: "Variance %",
    sortable: false,
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
): ProductionColumnConfig | undefined => {
  return DEFAULT_COLUMNS.find((col) => col.key === key);
};

// Get all reorderable columns (for UI)
export const getReorderableColumns = (): ProductionColumnConfig[] => {
  return DEFAULT_COLUMNS.filter((col) => col.reorderable !== false);
};

// Get all columns that can be hidden (not required)
export const getToggleableColumns = (): ProductionColumnConfig[] => {
  return DEFAULT_COLUMNS.filter((col) => !col.required);
};

// localStorage key for persistence
export const COLUMN_SETTINGS_STORAGE_KEY = "production-comparison-table-columns";
