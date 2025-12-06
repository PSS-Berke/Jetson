"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DEFAULT_COLUMNS,
  getDefaultColumnOrder,
  COLUMN_SETTINGS_STORAGE_KEY,
  ProjectionColumnConfig,
} from "./columnConfig";

export interface ColumnSettings {
  order: string[]; // Column keys in display order
  hidden: string[]; // Hidden column keys (array for JSON serialization)
}

interface UseColumnSettingsReturn {
  columnSettings: ColumnSettings;
  visibleColumns: ProjectionColumnConfig[];
  isColumnVisible: (key: string) => boolean;
  toggleColumnVisibility: (key: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  moveColumn: (key: string, direction: "up" | "down") => void;
  resetToDefaults: () => void;
  setColumnOrder: (newOrder: string[]) => void;
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
      return !columnSettings.hidden.includes(key);
    },
    [columnSettings.hidden]
  );

  // Get visible columns in order
  const visibleColumns = useMemo((): ProjectionColumnConfig[] => {
    const hiddenSet = new Set(columnSettings.hidden);
    return columnSettings.order
      .filter((key) => !hiddenSet.has(key))
      .map((key) => DEFAULT_COLUMNS.find((col) => col.key === key))
      .filter((col): col is ProjectionColumnConfig => col !== undefined);
  }, [columnSettings]);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((key: string) => {
    const column = DEFAULT_COLUMNS.find((col) => col.key === key);
    if (column?.required) return; // Can't hide required columns

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
      newOrder.splice(toIndex, 0, removed);
      return { ...prev, order: newOrder };
    });
  }, []);

  // Move column up or down
  const moveColumn = useCallback((key: string, direction: "up" | "down") => {
    setColumnSettings((prev) => {
      const currentIndex = prev.order.indexOf(key);
      if (currentIndex === -1) return prev;

      const newIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prev.order.length) return prev;

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
    setColumnSettings((prev) => ({ ...prev, order: newOrder }));
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
  };
}
