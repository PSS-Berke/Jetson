"use client";

import { useState, useRef, useEffect } from "react";
import { Columns3, GripVertical, RotateCcw } from "lucide-react";
import { DEFAULT_COLUMNS, ProjectionColumnConfig } from "./columnConfig";

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

  // Get column config by key
  const getColumn = (key: string): ProjectionColumnConfig | undefined => {
    return DEFAULT_COLUMNS.find((col) => col.key === key);
  };

  // Filter out columns that shouldn't be shown in settings (checkbox, notes controlled separately)
  const configurableColumns = columnOrder.filter((key) => {
    const col = getColumn(key);
    return col && key !== "checkbox" && key !== "notes";
  });

  const hiddenSet = new Set(hiddenColumns);
  const hiddenCount = configurableColumns.filter((key) =>
    hiddenSet.has(key)
  ).length;

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedItem(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem !== key) {
      setDragOverItem(key);
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetKey) {
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-dark)] hover:bg-gray-50 transition-colors"
        title="Configure columns"
      >
        <Columns3 className="w-4 h-4" />
        <span>Columns</span>
        {hiddenCount > 0 && (
          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
            {configurableColumns.length - hiddenCount}/{configurableColumns.length}
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
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[var(--border)] py-2 z-50">
          <div className="px-4 py-2 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-dark)]">
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
            <p className="text-xs text-[var(--text-light)] mt-1">
              Drag to reorder, click to show/hide
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {configurableColumns.map((key) => {
              const column = getColumn(key);
              if (!column) return null;

              const isHidden = hiddenSet.has(key);
              const isDragging = draggedItem === key;
              const isDragOver = dragOverItem === key;

              return (
                <div
                  key={key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, key)}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center px-3 py-2 hover:bg-gray-50 cursor-grab active:cursor-grabbing transition-colors ${
                    isDragging ? "opacity-50 bg-gray-100" : ""
                  } ${isDragOver ? "border-t-2 border-blue-500" : ""}`}
                >
                  <GripVertical className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                  <label className="flex items-center flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => onToggleColumn(key)}
                      className="w-4 h-4 mr-2 cursor-pointer"
                      disabled={column.required}
                    />
                    <span
                      className={`text-sm ${
                        isHidden
                          ? "text-[var(--text-light)]"
                          : "text-[var(--text-dark)]"
                      }`}
                    >
                      {column.label}
                    </span>
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
