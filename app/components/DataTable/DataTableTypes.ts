import { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface ColumnConfig<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => ReactNode;
  editable?: boolean;
  editType?: 'text' | 'number' | 'currency' | 'date';
  editValidator?: (value: string) => boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  mobileHidden?: boolean;
  getValue?: (row: T) => any; // For nested values like 'client.name'
}

export interface BulkAction<T = any> {
  label: string;
  icon?: ReactNode;
  onClick: (selectedRows: T[]) => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface SelectionConfig<T = any> {
  enabled: boolean;
  selectAllEnabled?: boolean;
  bulkActions?: BulkAction<T>[];
  onSelectionChange?: (selectedIds: number[], selectedRows: T[]) => void;
}

export interface BatchEditColumn {
  key: string;
  label?: string;
  mode: 'add' | 'set' | 'both';
  type: 'number' | 'currency';
}

export interface BatchChange {
  rowId: number;
  field: string;
  value: any;
  originalValue?: any;
}

export interface BatchEditConfig {
  enabled: boolean;
  columns: BatchEditColumn[];
  onBatchSave: (changes: BatchChange[]) => Promise<void>;
  onBatchCancel?: () => void;
}

export interface InlineEditConfig<T = any> {
  enabled: boolean;
  editableColumns?: string[];
  onSave: (rowId: number, field: string, value: any, row: T) => Promise<void>;
  onCancel?: () => void;
}

export interface MobileConfig<T = any> {
  viewMode?: 'cards' | 'table';
  cardTemplate?: (row: T, isSelected: boolean, onToggle: () => void) => ReactNode;
  visibleColumns?: string[];
}

export interface PaginationConfig {
  enabled: boolean;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number, pageSize: number) => void;
}

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: ColumnConfig<T>[];
  getRowId?: (row: T) => number | string;

  // Selection & Bulk Actions
  selection?: SelectionConfig<T>;

  // Editing
  batchEdit?: BatchEditConfig;
  inlineEdit?: InlineEditConfig<T>;

  // Pagination
  pagination?: PaginationConfig;

  // Mobile
  mobile?: MobileConfig<T>;

  // Sorting
  defaultSort?: SortConfig;
  onSortChange?: (sort: SortConfig) => void;

  // Row Actions
  onRowClick?: (row: T) => void;

  // Styling
  className?: string;
  striped?: boolean;
  hover?: boolean;

  // Empty State
  emptyMessage?: string;

  // Loading
  loading?: boolean;
}
