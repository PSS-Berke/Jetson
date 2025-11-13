import { ColumnConfig, InlineEditConfig } from "./DataTableTypes";
import { DataTableCell } from "./DataTableCell";

interface DataTableRowProps<T> {
  row: T;
  rowId: number | string;
  columns: ColumnConfig<T>[];
  selectionEnabled: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRowClick?: (row: T) => void;
  inlineEdit?: InlineEditConfig<T>;
  striped?: boolean;
  hover?: boolean;
  index: number;
}

export function DataTableRow<T>({
  row,
  rowId,
  columns,
  selectionEnabled,
  isSelected,
  onToggleSelect,
  onRowClick,
  inlineEdit,
  striped,
  hover,
  index,
}: DataTableRowProps<T>) {
  const getValue = (row: T, column: ColumnConfig<T>): any => {
    if (column.getValue) {
      return column.getValue(row);
    }

    // Handle nested keys like 'client.name'
    const keys = column.key.split(".");
    let value: any = row;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) break;
    }
    return value;
  };

  const handleCellClick = (e: React.MouseEvent, column: ColumnConfig<T>) => {
    // Don't trigger row click if clicking on an editable cell
    if (column.editable && inlineEdit?.enabled) {
      e.stopPropagation();
      return;
    }
  };

  const isEditable = (column: ColumnConfig<T>) => {
    if (!inlineEdit?.enabled || !column.editable) return false;
    if (
      inlineEdit.editableColumns &&
      !inlineEdit.editableColumns.includes(column.key)
    ) {
      return false;
    }
    return true;
  };

  const handleSaveCell = async (column: ColumnConfig<T>, value: any) => {
    if (inlineEdit?.onSave) {
      await inlineEdit.onSave(rowId as number, column.key, value, row);
    }
  };

  return (
    <tr
      className={`
        border-b border-gray-200
        ${striped && index % 2 === 1 ? "bg-gray-50" : "bg-white"}
        ${hover ? "hover:bg-blue-50" : ""}
        ${isSelected ? "bg-blue-100" : ""}
        ${onRowClick ? "cursor-pointer" : ""}
      `}
      onClick={() => onRowClick?.(row)}
    >
      {selectionEnabled && (
        <td
          className="px-3 py-2 w-12"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 cursor-pointer"
          />
        </td>
      )}
      {columns.map((column) => {
        const value = getValue(row, column);
        const editable = isEditable(column);

        return (
          <DataTableCell
            key={column.key}
            row={row}
            column={column}
            value={value}
            isEditable={editable}
            onSave={(newValue) => handleSaveCell(column, newValue)}
            onCancel={inlineEdit?.onCancel}
          />
        );
      })}
    </tr>
  );
}
