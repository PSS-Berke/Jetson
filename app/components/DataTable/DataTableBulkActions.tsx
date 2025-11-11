import { BulkAction } from './DataTableTypes';

interface DataTableBulkActionsProps<T> {
  selectedCount: number;
  selectedRows: T[];
  bulkActions: BulkAction<T>[];
  onClearSelection: () => void;
}

export function DataTableBulkActions<T>({
  selectedCount,
  selectedRows,
  bulkActions,
  onClearSelection
}: DataTableBulkActionsProps<T>) {
  if (selectedCount === 0) {
    return null;
  }

  const getVariantClass = (variant?: 'primary' | 'secondary' | 'danger') => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'secondary':
        return 'bg-gray-600 hover:bg-gray-700 text-white';
      case 'primary':
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-blue-900">
          {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-sm text-blue-700 hover:text-blue-900 underline"
        >
          Clear selection
        </button>
      </div>
      <div className="flex items-center gap-2">
        {bulkActions.map((action, index) => (
          <button
            key={index}
            onClick={() => action.onClick(selectedRows)}
            disabled={action.disabled}
            className={`
              px-4 py-2 rounded font-medium text-sm
              flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
              ${getVariantClass(action.variant)}
            `}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
