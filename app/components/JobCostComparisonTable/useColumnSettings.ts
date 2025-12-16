"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DEFAULT_COLUMNS,
  getDefaultColumnOrder,
  COLUMN_SETTINGS_STORAGE_KEY,
  JobCostColumnConfig,
  getColumnByKey,
} from "./columnConfig";

export interface ColumnSettings {
  order: string[]; // Column keys in display order
  hidden: string[]; // Hidden column keys (array for JSON serialization)
}

// Represents a column ready for rendering with all metadata
export interface OrderedColumn {
  config: JobCostColumnConfig;
  isVisible: boolean;
}

interface UseColumnSettingsReturn {
  columnSettings: ColumnSettings;
  visibleColumns: JobCostColumnConfig[];
  isColumnVisible: (key: string) => boolean;
  toggleColumnVisibility: (key: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  moveColumn: (key: string, direction: "up" | "down") => void;
  resetToDefaults: () => void;
  setColumnOrder: (newOrder: string[]) => void;
  getOrderedColumns: () => OrderedColumn[];
  getReorderableColumnKeys: () => string[];
}

const getDefaultSettings = (): ColumnSettings => ({
  order: getDefaultColumnOrder(),
  hidden: [],
});

export function useColumnSettings(): UseColumnSettingsReturn {
  const [columnSettings, setColumnSettings] = useState<ColumnSettings>(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(COLUMN_SETTINGS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as ColumnSettings;
          // Validate that all required columns exist
          const defaultOrder = getDefaultColumnOrder();
          const hasAllColumns = defaultOrder.every(
            (key) => parsed.order.includes(key)
          );
          if (hasAllColumns) {
            return parsed;
          }
          // Add any missing columns
          const missingColumns = defaultOrder.filter(
            (key) => !parsed.order.includes(key)
          );
          return {
            ...parsed,
            order: [...parsed.order, ...missingColumns],
          };
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
        localStorage.setItem(
          COLUMN_SETTINGS_STORAGE_KEY,
          JSON.stringify(columnSettings)
        );
      } catch (e) {
        console.warn("Failed to save column settings to localStorage:", e);
      }
    }
  }, [columnSettings]);

  // Check if a column is visible
  const isColumnVisible = useCallback(
    (key: string): boolean => {
      const config = getColumnByKey(key);
      if (!config) return false;

      // Required columns are always visible
      if (config.required) return true;

      // Check hidden array
      return !columnSettings.hidden.includes(key);
    },
    [columnSettings.hidden]
  );

  // Get visible columns in order
  const visibleColumns = useMemo((): JobCostColumnConfig[] => {
    const hiddenSet = new Set(columnSettings.hidden);
    return columnSettings.order
      .filter((key) => !hiddenSet.has(key))
      .map((key) => DEFAULT_COLUMNS.find((col) => col.key === key))
      .filter((col): col is JobCostColumnConfig => col !== undefined);
  }, [columnSettings]);

  // Get ordered columns with full metadata for unified rendering
  const getOrderedColumns = useCallback((): OrderedColumn[] => {
    return columnSettings.order
      .map((key) => {
        const config = getColumnByKey(key);
        if (!config) return null;
        return {
          config,
          isVisible: isColumnVisible(key),
        };
      })
      .filter((col): col is OrderedColumn => col !== null);
  }, [columnSettings.order, isColumnVisible]);

  // Get reorderable column keys for settings UI
  const getReorderableColumnKeys = useCallback((): string[] => {
    return columnSettings.order.filter((key) => {
      const config = getColumnByKey(key);
      return config && config.reorderable !== false;
    });
  }, [columnSettings.order]);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((key: string) => {
    const column = DEFAULT_COLUMNS.find((col) => col.key === key);
    // Can't toggle required columns
    if (column?.required) return;

    setColumnSettings((prev) => {
      const isHidden = prev.hidden.includes(key);
      return {
        ...prev,
        hidden: isHidden
          ? prev.hidden.filter((k) => k !== key)
          : [...prev.hidden, key],
      };
    });
  }, []);

  // Reorder columns by indices
  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumnSettings((prev) => {
      const newOrder = [...prev.order];
      const [removed] = newOrder.splice(fromIndex, 1);

      // Check if the column being moved is reorderable
      const config = getColumnByKey(removed);
      if (config?.reorderable === false) return prev;

      newOrder.splice(toIndex, 0, removed);
      return { ...prev, order: newOrder };
    });
  }, []);

  // Move column up or down
  const moveColumn = useCallback((key: string, direction: "up" | "down") => {
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
  }, []);

  // Set column order directly (for drag-and-drop)
  const setColumnOrder = useCallback((newOrder: string[]) => {
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
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setColumnSettings(getDefaultSettings());
  }, []);

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
