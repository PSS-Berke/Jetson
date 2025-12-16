"use client";

import { useState, useRef, useEffect } from "react";
import { Columns3, GripVertical, RotateCcw } from "lucide-react";
import { DEFAULT_COLUMNS, JobCostColumnConfig, getColumnByKey } from "./columnConfig";

interface ColumnSettingsPopoverProps {
  columnOrder: string[];
  hiddenColumns: string[];
  onToggleColumn: (key: string) => void;
  onReorderColumns: (newOrder: string[]) => void;
  onResetToDefaults: () => void;
}

export default function ColumnSettingsPopover({
  columnOrder,
  hiddenColumns,
  onToggleColumn,
  onReorderColumns,
  onResetToDefaults,
}: ColumnSettingsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Filter columns based on config properties
  const configurableColumns = columnOrder.filter((key) => {
    const config = getColumnByKey(key);
    if (!config) return false;
    return config.reorderable !== false || !config.required;
  });

  const hiddenSet = new Set(hiddenColumns);

  // Count only toggleable columns (not required)
  const toggleableColumns = configurableColumns.filter((key) => {
    const config = getColumnByKey(key);
    return config && !config.required;
  });
  const hiddenCount = toggleableColumns.filter((key) => hiddenSet.has(key)).length;

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, key: string) => {
    const config = getColumnByKey(key);
    if (config?.reorderable === false) {
      e.preventDefault();
      return;
    }
    setDraggedItem(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    const config = getColumnByKey(key);
    if (config?.reorderable === false) return;
    if (draggedItem && draggedItem !== key) {
      setDragOverItem(key);
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const targetConfig = getColumnByKey(targetKey);
    if (!draggedItem || draggedItem === targetKey || targetConfig?.reorderable === false) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedItem);
    const targetIndex = newOrder.indexOf(targetKey);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);
      onReorderColumns(newOrder);
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Check if a column can be toggled
  const canToggle = (config: JobCostColumnConfig): boolean => {
    return !config.required;
  };

  // Check if column is reorderable
  const canReorder = (config: JobCostColumnConfig): boolean => {
    return config.reorderable !== false;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        title="Configure columns"
      >
        <Columns3 className="w-4 h-4" />
        <span>Columns</span>
        {hiddenCount > 0 && (
          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
            {toggleableColumns.length - hiddenCount}/{toggleableColumns.length}
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                Table Columns
              </span>
              <button
                onClick={() => {
                  onResetToDefaults();
                }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                title="Reset to defaults"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Drag to reorder, click to show/hide
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {configurableColumns.map((key) => {
              const config = getColumnByKey(key);
              if (!config) return null;

              const isHidden = hiddenSet.has(key);
              const isDragging = draggedItem === key;
              const isDragOver = dragOverItem === key;
              const isToggleable = canToggle(config);
              const isReorderable = canReorder(config);

              return (
                <div
                  key={key}
                  draggable={isReorderable}
                  onDragStart={(e) => handleDragStart(e, key)}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center px-3 py-2 hover:bg-gray-50 transition-colors ${
                    isReorderable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                  } ${isDragging ? "opacity-50 bg-gray-100" : ""} ${
                    isDragOver ? "border-t-2 border-blue-500" : ""
                  }`}
                >
                  {isReorderable ? (
                    <GripVertical className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 mr-2 flex-shrink-0" />
                  )}
                  <label className="flex items-center flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => isToggleable && onToggleColumn(key)}
                      className={`w-4 h-4 mr-2 ${isToggleable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                      disabled={!isToggleable}
                    />
                    <span
                      className={`text-sm flex-1 ${
                        isHidden
                          ? "text-gray-400"
                          : "text-gray-700"
                      }`}
                    >
                      {config.label || config.key}
                    </span>
                    {config.required && (
                      <span className="ml-2 text-[10px] text-gray-400">
                        Required
                      </span>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
