// Revenue Projections Table - Unified Exports
// Financial/revenue-focused table for CFO revenue view

// Column configuration
export {
  DEFAULT_COLUMNS,
  getDefaultColumnOrder,
  getColumnByKey,
  getReorderableColumns,
  getToggleableColumns,
  COLUMN_SETTINGS_STORAGE_KEY,
} from "./columnConfig";
export type {
  SortField,
  ColumnType,
  RevenueColumnConfig,
} from "./columnConfig";

// Column settings hook
export { useColumnSettings } from "./useColumnSettings";
export type {
  ColumnSettings,
  ExternalColumnControls,
  OrderedColumn,
} from "./useColumnSettings";

// Column renderers
export {
  renderColumnHeader,
  renderCell,
  calculateColumnCount,
  SortIcon,
  hexToRgba,
  formatRevenue,
  formatJobNumber,
} from "./columnRenderers";
export type {
  HeaderRenderContext,
  CellRenderContext,
} from "./columnRenderers";

// Column settings UI
export { default as ColumnSettingsPopover } from "./ColumnSettingsPopover";

// Version group row components
export {
  RevenueVersionGroupHeaderRow,
  RevenueVersionRow,
} from "./RevenueVersionGroupRow";
