"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DEFAULT_COLUMNS,
  getDefaultColumnOrder,
  COLUMN_SETTINGS_STORAGE_KEY,
  InlineJobCostColumnConfig,
  getColumnByKey,
} from "./columnConfig";

export interface ColumnSettings {
  order: string[];
  hidden: string[];
}

export interface OrderedColumn {
  config: InlineJobCostColumnConfig;
  isVisible: boolean;
}

interface UseColumnSettingsReturn {
  columnSettings: ColumnSettings;
  visibleColumns: InlineJobCostColumnConfig[];
  isColumnVisible: (key: string) => boolean;
  toggleColumnVisibility: (key: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  moveColumn: (key: string, direction: "up" | "down") => void;
  resetToDefaults: () => void;
  setColumnOrder: (newOrder: string[]) => void;
  getOrderedColumns: () => OrderedColumn[];
  getReorderableColumnKeys: () => string[];
  // Get visible columns filtered by batch mode
  getVisibleColumnsForMode: (isBatchMode: boolean) => InlineJobCostColumnConfig[];
}

const getDefaultSettings = (): ColumnSettings => ({
  order: getDefaultColumnOrder(),
  hidden: [],
});

export function useColumnSettings(): UseColumnSettingsReturn {
  const [columnSettings, setColumnSettings] = useState<ColumnSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(COLUMN_SETTINGS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as ColumnSettings;
          const defaultOrder = getDefaultColumnOrder();
          const hasAllColumns = defaultOrder.every(
            (key) => parsed.order.includes(key)
          );
          if (hasAllColumns) {
            return parsed;
          }
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

  const isColumnVisible = useCallback(
    (key: string): boolean => {
      const config = getColumnByKey(key);
      if (!config) return false;
      if (config.required) return true;
      return !columnSettings.hidden.includes(key);
    },
    [columnSettings.hidden]
  );

  const visibleColumns = useMemo((): InlineJobCostColumnConfig[] => {
    const hiddenSet = new Set(columnSettings.hidden);
    return columnSettings.order
      .filter((key) => !hiddenSet.has(key))
      .map((key) => DEFAULT_COLUMNS.find((col) => col.key === key))
      .filter((col): col is InlineJobCostColumnConfig => col !== undefined);
  }, [columnSettings]);

  // Get visible columns filtered by batch mode
  const getVisibleColumnsForMode = useCallback(
    (isBatchMode: boolean): InlineJobCostColumnConfig[] => {
      return visibleColumns.filter((col) => {
        // Always hide batchModeOnly columns when not in batch mode
        if (col.batchModeOnly && !isBatchMode) return false;
        // In batch mode, hide profit_percentage (we show profit_preview instead)
        if (isBatchMode && col.key === "profit_percentage") return false;
        return true;
      });
    },
    [visibleColumns]
  );

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

  const getReorderableColumnKeys = useCallback((): string[] => {
    return columnSettings.order.filter((key) => {
      const config = getColumnByKey(key);
      return config && config.reorderable !== false;
    });
  }, [columnSettings.order]);

  const toggleColumnVisibility = useCallback((key: string) => {
    const column = DEFAULT_COLUMNS.find((col) => col.key === key);
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

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumnSettings((prev) => {
      const newOrder = [...prev.order];
      const [removed] = newOrder.splice(fromIndex, 1);

      const config = getColumnByKey(removed);
      if (config?.reorderable === false) return prev;

      newOrder.splice(toIndex, 0, removed);
      return { ...prev, order: newOrder };
    });
  }, []);

  const moveColumn = useCallback((key: string, direction: "up" | "down") => {
    const config = getColumnByKey(key);
    if (config?.reorderable === false) return;

    setColumnSettings((prev) => {
      const currentIndex = prev.order.indexOf(key);
      if (currentIndex === -1) return prev;

      const newIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prev.order.length) return prev;

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

  const setColumnOrder = useCallback((newOrder: string[]) => {
    setColumnSettings((prev) => {
      const nonReorderablePositions: { key: string; index: number }[] = [];
      prev.order.forEach((key, index) => {
        const config = getColumnByKey(key);
        if (config?.reorderable === false) {
          nonReorderablePositions.push({ key, index });
        }
      });

      const filteredNewOrder = newOrder.filter((key) => {
        const config = getColumnByKey(key);
        return config?.reorderable !== false;
      });

      const finalOrder = [...filteredNewOrder];
      nonReorderablePositions.forEach(({ key, index }) => {
        finalOrder.splice(index, 0, key);
      });

      return { ...prev, order: finalOrder };
    });
  }, []);

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
    getVisibleColumnsForMode,
  };
}
