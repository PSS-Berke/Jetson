"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DEFAULT_COLUMNS,
  getDefaultColumnOrder,
  COLUMN_SETTINGS_STORAGE_KEY,
  RevenueColumnConfig,
  getColumnByKey,
} from "./columnConfig";

export interface ColumnSettings {
  order: string[]; // Column keys in display order
  hidden: string[]; // Hidden column keys (array for JSON serialization)
}

// External controls that affect column visibility (passed from parent component)
export interface ExternalColumnControls {
  showNotes?: boolean;
}

// Represents a column ready for rendering with all metadata
export interface OrderedColumn {
  config: RevenueColumnConfig;
  isVisible: boolean;
}

interface UseColumnSettingsReturn {
  columnSettings: ColumnSettings;
  visibleColumns: RevenueColumnConfig[];
  isColumnVisible: (key: string, externalControls?: ExternalColumnControls) => boolean;
  toggleColumnVisibility: (key: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  moveColumn: (key: string, direction: "up" | "down") => void;
  resetToDefaults: () => void;
  setColumnOrder: (newOrder: string[]) => void;
  getOrderedColumns: (externalControls?: ExternalColumnControls) => OrderedColumn[];
  getReorderableColumnKeys: () => string[];
}

const getDefaultSettings = (): ColumnSettings => ({
  order: getDefaultColumnOrder(),
  hidden: [],
});

// Migrate old settings and ensure all columns are present
const migrateSettings = (settings: ColumnSettings): ColumnSettings => {
  let newOrder = [...settings.order];
  let changed = false;

  // Migrate "total" to "total_revenue" if needed
  const totalIndex = newOrder.indexOf("total");
  if (totalIndex !== -1) {
    newOrder[totalIndex] = "total_revenue";
    changed = true;
  }

  // Get all default column keys
  const defaultOrder = getDefaultColumnOrder();

  // Add any missing columns in their default positions
  defaultOrder.forEach((key, defaultIndex) => {
    if (!newOrder.includes(key)) {
      // Insert at the default position, or at end if that would exceed length
      const insertIndex = Math.min(defaultIndex, newOrder.length);
      newOrder.splice(insertIndex, 0, key);
      changed = true;
    }
  });

  // Remove any columns that no longer exist in defaults
  const validKeys = new Set(defaultOrder);
  const filteredOrder = newOrder.filter(key => validKeys.has(key));
  if (filteredOrder.length !== newOrder.length) {
    newOrder = filteredOrder;
    changed = true;
  }

  return changed ? { ...settings, order: newOrder } : settings;
};

export function useColumnSettings(): UseColumnSettingsReturn {
  const [columnSettings, setColumnSettings] = useState<ColumnSettings>(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(COLUMN_SETTINGS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as ColumnSettings;
          // Migrate old settings - this now handles all missing/extra columns
          return migrateSettings(parsed);
        }
      } catch (e) {
        console.warn("Failed to load revenue column settings from localStorage:", e);
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
        console.warn("Failed to save revenue column settings to localStorage:", e);
      }
    }
  }, [columnSettings]);

  // Check if a column is visible (considers external controls)
  const isColumnVisible = useCallback(
    (key: string, externalControls?: ExternalColumnControls): boolean => {
      const config = getColumnByKey(key);
      if (!config) return false;

      // Required columns are always visible
      if (config.required) return true;

      // Check external control (e.g., showNotes prop)
      if (config.externalControl) {
        const controlValue = externalControls?.[config.externalControl as keyof ExternalColumnControls];
        return controlValue === true;
      }

      // Check hidden array
      return !columnSettings.hidden.includes(key);
    },
    [columnSettings.hidden]
  );

  // Get visible columns in order (legacy - for backward compatibility)
  const visibleColumns = useMemo((): RevenueColumnConfig[] => {
    const hiddenSet = new Set(columnSettings.hidden);
    return columnSettings.order
      .filter((key) => !hiddenSet.has(key))
      .map((key) => DEFAULT_COLUMNS.find((col) => col.key === key))
      .filter((col): col is RevenueColumnConfig => col !== undefined);
  }, [columnSettings]);

  // Get ordered columns with full metadata for unified rendering
  const getOrderedColumns = useCallback(
    (externalControls?: ExternalColumnControls): OrderedColumn[] => {
      return columnSettings.order
        .map((key) => {
          const config = getColumnByKey(key);
          if (!config) return null;
          return {
            config,
            isVisible: isColumnVisible(key, externalControls),
          };
        })
        .filter((col): col is OrderedColumn => col !== null);
    },
    [columnSettings.order, isColumnVisible]
  );

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
  }, []);

  // Reorder columns by indices (only allows reordering of reorderable columns)
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
    setColumnSettings((prev) => {
      // Simply use the new order directly - the popover already handles
      // keeping non-reorderable columns in place by not allowing them to be dragged
      // We just need to ensure all columns are present
      const allKeys = new Set(getDefaultColumnOrder());
      const newOrderSet = new Set(newOrder);

      // Add any missing columns at the end
      const missingKeys = [...allKeys].filter(key => !newOrderSet.has(key));

      return { ...prev, order: [...newOrder, ...missingKeys] };
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
