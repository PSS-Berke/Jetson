import { ColumnConfig } from './DataTableTypes';

interface DataTableMobileCardProps<T> {
  row: T;
  columns: ColumnConfig<T>[];
  selectionEnabled: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRowClick?: (row: T) => void;
  customTemplate?: (row: T, isSelected: boolean, onToggle: () => void) => React.ReactNode;
}

export function DataTableMobileCard<T>({
  row,
  columns,
  selectionEnabled,
  isSelected,
  onToggleSelect,
  onRowClick,
  customTemplate
}: DataTableMobileCardProps<T>) {
  const getValue = (row: T, column: ColumnConfig<T>): any => {
    if (column.getValue) {
      return column.getValue(row);
    }

    const keys = column.key.split('.');
    let value: any = row;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) break;
    }
    return value;
  };

  // Use custom template if provided
  if (customTemplate) {
    return (
      <div
        className={`
          bg-white border border-gray-200 rounded-lg p-4 mb-3
          ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
          ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
        `}
        onClick={() => onRowClick?.(row)}
      >
        {customTemplate(row, isSelected, onToggleSelect)}
      </div>
    );
  }

  // Default card layout
  return (
    <div
      className={`
        bg-white border border-gray-200 rounded-lg p-4 mb-3
        ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
      `}
      onClick={() => onRowClick?.(row)}
    >
      {selectionEnabled && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-600">Select</span>
          </label>
        </div>
      )}

      <div className="space-y-2">
        {columns
          .filter((col) => !col.mobileHidden)
          .map((column) => {
            const value = getValue(row, column);
            let displayValue = value;

            if (column.render) {
              displayValue = column.render(value, row);
            } else if (value === null || value === undefined) {
              displayValue = '-';
            } else if (typeof value === 'number') {
              displayValue = value.toLocaleString();
            }

            return (
              <div key={column.key} className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">
                  {column.label}:
                </span>
                <span className="text-sm text-gray-900">{displayValue}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
