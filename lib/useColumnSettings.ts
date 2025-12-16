"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BaseColumnConfig,
  ColumnSettings,
  getColumnSettingsKey,
  getDefaultColumnSettings,
} from "./columnConfig";

// External controls that affect column visibility (passed from parent component)
export interface ExternalColumnControls {
  showNotes?: boolean;
  showProcesses?: boolean;
  [key: string]: boolean | undefined;
}

// Represents a column ready for rendering with all metadata
export interface OrderedColumn<T extends BaseColumnConfig = BaseColumnConfig> {
  config: T;
  isVisible: boolean;
}

interface UseColumnSettingsOptions<T extends BaseColumnConfig> {
  tableId: string;
  defaultColumns: T[];
  getColumnByKey: (key: string) => T | undefined;
  getDefaultOrder: () => string[];
  migrationFn?: (settings: ColumnSettings) => ColumnSettings;
}

interface UseColumnSettingsReturn<T extends BaseColumnConfig> {
  columnSettings: ColumnSettings;
  visibleColumns: T[];
  isColumnVisible: (key: string, externalControls?: ExternalColumnControls) => boolean;
  toggleColumnVisibility: (key: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  moveColumn: (key: string, direction: "up" | "down") => void;
  resetToDefaults: () => void;
  setColumnOrder: (newOrder: string[]) => void;
  getOrderedColumns: (externalControls?: ExternalColumnControls) => OrderedColumn<T>[];
  getReorderableColumnKeys: () => string[];
}

export function useColumnSettings<T extends BaseColumnConfig>({
  tableId,
  defaultColumns,
  getColumnByKey,
  getDefaultOrder,
  migrationFn,
}: UseColumnSettingsOptions<T>): UseColumnSettingsReturn<T> {
  const storageKey = getColumnSettingsKey(tableId);

  const getDefaultSettings = useCallback(
    (): ColumnSettings => ({
      order: getDefaultOrder(),
      hidden: [],
    }),
    [getDefaultOrder]
  );

  const [columnSettings, setColumnSettings] = useState<ColumnSettings>(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          let parsed = JSON.parse(saved) as ColumnSettings;

          // Apply migration if provided
          if (migrationFn) {
            parsed = migrationFn(parsed);
          }

          // Validate that all required columns exist
          const defaultOrder = getDefaultOrder();
          const hasAllColumns = defaultOrder.every(
            (key) => parsed.order.includes(key)
          );

          // Add any new columns that don't exist in saved settings
          if (!hasAllColumns) {
            const missingColumns = defaultOrder.filter(
              (key) => !parsed.order.includes(key)
            );
            parsed.order = [...parsed.order, ...missingColumns];
          }

          return parsed;
        }
      } catch (e) {
        console.warn("Failed to load column settings from localStorage:", e);
      }
    }
    return getDefaultSettings();
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(columnSettings));
      } catch (e) {
        console.warn("Failed to save column settings to localStorage:", e);
      }
    }
  }, [columnSettings, storageKey]);

  // Check if a column is visible (considers external controls)
  const isColumnVisible = useCallback(
    (key: string, externalControls?: ExternalColumnControls): boolean => {
      const config = getColumnByKey(key);
      if (!config) return false;

      // Required columns are always visible
      if (config.required) return true;

      // Check external control (e.g., showNotes prop)
      if (config.externalControl) {
        const controlValue = externalControls?.[config.externalControl];
        return controlValue === true;
      }

      // Check hidden array
      return !columnSettings.hidden.includes(key);
    },
    [columnSettings.hidden, getColumnByKey]
  );

  // Get visible columns in order (legacy - for backward compatibility)
  const visibleColumns = useMemo((): T[] => {
    const hiddenSet = new Set(columnSettings.hidden);
    return columnSettings.order
      .filter((key) => !hiddenSet.has(key))
      .map((key) => defaultColumns.find((col) => col.key === key))
      .filter((col): col is T => col !== undefined);
  }, [columnSettings, defaultColumns]);

  // Get ordered columns with full metadata for unified rendering
  const getOrderedColumns = useCallback(
    (externalControls?: ExternalColumnControls): OrderedColumn<T>[] => {
      return columnSettings.order
        .map((key) => {
          const config = getColumnByKey(key);
          if (!config) return null;
          return {
            config,
            isVisible: isColumnVisible(key, externalControls),
          };
        })
        .filter((col): col is OrderedColumn<T> => col !== null);
    },
    [columnSettings.order, isColumnVisible, getColumnByKey]
  );

  // Get reorderable column keys for settings UI
  const getReorderableColumnKeys = useCallback((): string[] => {
    return columnSettings.order.filter((key) => {
      const config = getColumnByKey(key);
      return config && config.reorderable !== false;
    });
  }, [columnSettings.order, getColumnByKey]);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((key: string) => {
    const column = defaultColumns.find((col) => col.key === key);
    // Can't toggle required columns or externally controlled columns
    if (column?.required || column?.externalControl) return;

    setColumnSettings((prev) => {
      const isHidden = prev.hidden.includes(key);
      return {
        ...prev,
        hidden: isHidden
          ? prev.hidden.filter((k) => k !== key)
          : [...prev.hidden, key],
      };
    });
  }, [defaultColumns]);

  // Reorder columns by indices (only allows reordering of reorderable columns)
  const reorderColumns = useCallback(
    (fromIndex: number, toIndex: number) => {
      setColumnSettings((prev) => {
        const newOrder = [...prev.order];
        const [removed] = newOrder.splice(fromIndex, 1);

        // Check if the column being moved is reorderable
        const config = getColumnByKey(removed);
        if (config?.reorderable === false) return prev;

        newOrder.splice(toIndex, 0, removed);
        return { ...prev, order: newOrder };
      });
    },
    [getColumnByKey]
  );

  // Move column up or down
  const moveColumn = useCallback(
    (key: string, direction: "up" | "down") => {
      const config = getColumnByKey(key);
      if (config?.reorderable === false) return;

      setColumnSettings((prev) => {
        const currentIndex = prev.order.indexOf(key);
        if (currentIndex === -1) return prev;

        const newIndex =
          direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= prev.order.length) return prev;

        // Check if target position is occupied by a non-reorderable column
        const targetKey = prev.order[newIndex];
        const targetConfig = getColumnByKey(targetKey);
        if (targetConfig?.reorderable === false) return prev;

        const newOrder = [...prev.order];
        [newOrder[currentIndex], newOrder[newIndex]] = [
          newOrder[newIndex],
          newOrder[currentIndex],
        ];
        return { ...prev, order: newOrder };
      });
    },
    [getColumnByKey]
  );

  // Set column order directly (for drag-and-drop)
  const setColumnOrder = useCallback(
    (newOrder: string[]) => {
      // Ensure non-reorderable columns stay in their positions
      setColumnSettings((prev) => {
        // Get non-reorderable columns and their positions
        const nonReorderablePositions: { key: string; index: number }[] = [];
        prev.order.forEach((key, index) => {
          const config = getColumnByKey(key);
          if (config?.reorderable === false) {
            nonReorderablePositions.push({ key, index });
          }
        });

        // Filter out non-reorderable from new order
        const filteredNewOrder = newOrder.filter((key) => {
          const config = getColumnByKey(key);
          return config?.reorderable !== false;
        });

        // Reinsert non-reorderable columns at their original positions
        const finalOrder = [...filteredNewOrder];
        nonReorderablePositions.forEach(({ key, index }) => {
          finalOrder.splice(index, 0, key);
        });

        return { ...prev, order: finalOrder };
      });
    },
    [getColumnByKey]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setColumnSettings(getDefaultSettings());
  }, [getDefaultSettings]);

  return {
    columnSettings,
    visibleColumns,
    isColumnVisible,
    toggleColumnVisibility,
    reorderColumns,
    moveColumn,
    resetToDefaults,
    setColumnOrder,
    getOrderedColumns,
    getReorderableColumnKeys,
  };
}
