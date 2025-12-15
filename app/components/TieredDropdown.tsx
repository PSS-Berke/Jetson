"use client";

import React, { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, X, Filter } from "lucide-react";
import type { ParsedJob } from "@/hooks/useJobs";
import {
  buildTieredData,
  type TieredFilter,
  type TieredData,
  type TierItem,
  getSubCategoryFields,
} from "@/lib/tieredFilterUtils";
import { getProcessTypeColor } from "@/lib/processTypeConfig";

interface TieredDropdownProps {
  jobs: ParsedJob[];
  selectedFilters: TieredFilter;
  onFilterChange: (filters: TieredFilter) => void;
}

export default function TieredDropdown({
  jobs,
  selectedFilters,
  onFilterChange,
}: TieredDropdownProps) {
  // Track which tiers are expanded
  const [expandedProcessType, setExpandedProcessType] = useState<string | null>(null);
  const [expandedPrimaryCategory, setExpandedPrimaryCategory] = useState<string | null>(null);

  // Build tiered data from jobs
  const tieredData = useMemo<TieredData>(() => {
    return buildTieredData(jobs);
  }, [jobs]);

  // Handle Tier 1 click (Process Type)
  const handleProcessTypeClick = useCallback((processType: string) => {
    if (expandedProcessType === processType) {
      // Collapse if already expanded
      setExpandedProcessType(null);
      setExpandedPrimaryCategory(null);
    } else {
      // Expand and select
      setExpandedProcessType(processType);
      setExpandedPrimaryCategory(null);
      onFilterChange({
        processType,
        primaryCategory: undefined,
        subCategories: undefined,
      });
    }
  }, [expandedProcessType, onFilterChange]);

  // Handle Tier 2 click (Primary Category / Basic OE)
  const handlePrimaryCategoryClick = useCallback((primaryCategory: string) => {
    if (!expandedProcessType) return;

    if (expandedPrimaryCategory === primaryCategory) {
      // Collapse if already expanded
      setExpandedPrimaryCategory(null);
      // Keep process type filter but remove primary category
      onFilterChange({
        ...selectedFilters,
        primaryCategory: undefined,
        subCategories: undefined,
      });
    } else {
      // Expand and select
      setExpandedPrimaryCategory(primaryCategory);
      onFilterChange({
        ...selectedFilters,
        processType: expandedProcessType,
        primaryCategory,
        subCategories: undefined,
      });
    }
  }, [expandedProcessType, expandedPrimaryCategory, selectedFilters, onFilterChange]);

  // Handle Tier 3 click (Sub-category value)
  const handleSubCategoryClick = useCallback((fieldName: string, value: string) => {
    if (!expandedProcessType || !expandedPrimaryCategory) return;

    const currentSubCategories = selectedFilters.subCategories || {};
    const currentValues = currentSubCategories[fieldName] || [];

    let newValues: string[];
    if (currentValues.includes(value)) {
      // Remove value
      newValues = currentValues.filter((v) => v !== value);
    } else {
      // Add value (single select for now)
      newValues = [value];
    }

    const newSubCategories = { ...currentSubCategories };
    if (newValues.length > 0) {
      newSubCategories[fieldName] = newValues;
    } else {
      delete newSubCategories[fieldName];
    }

    onFilterChange({
      ...selectedFilters,
      subCategories: Object.keys(newSubCategories).length > 0 ? newSubCategories : undefined,
    });
  }, [expandedProcessType, expandedPrimaryCategory, selectedFilters, onFilterChange]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setExpandedProcessType(null);
    setExpandedPrimaryCategory(null);
    onFilterChange({
      processType: undefined,
      primaryCategory: undefined,
      subCategories: undefined,
    });
  }, [onFilterChange]);

  // Check if a sub-category value is selected
  const isSubCategorySelected = (fieldName: string, value: string): boolean => {
    const currentValues = selectedFilters.subCategories?.[fieldName] || [];
    return currentValues.includes(value);
  };

  // Get the active filter description
  const getActiveFilterText = (): string => {
    const parts: string[] = [];
    if (selectedFilters.processType) {
      const processTypeItem = tieredData.processTypes.find(
        (p) => p.value === selectedFilters.processType
      );
      parts.push(processTypeItem?.label || selectedFilters.processType);
    }
    if (selectedFilters.primaryCategory) {
      parts.push(selectedFilters.primaryCategory);
    }
    if (selectedFilters.subCategories) {
      Object.entries(selectedFilters.subCategories).forEach(([fieldName, values]) => {
        if (values.length > 0) {
          const subFields = selectedFilters.processType
            ? getSubCategoryFields(selectedFilters.processType)
            : [];
          const field = subFields.find((f) => f.name === fieldName);
          const label = field?.label || fieldName;
          parts.push(`${label}: ${values.join(", ")}`);
        }
      });
    }
    return parts.join(" → ");
  };

  const hasActiveFilters =
    selectedFilters.processType ||
    selectedFilters.primaryCategory ||
    (selectedFilters.subCategories && Object.keys(selectedFilters.subCategories).length > 0);

  return (
    <div className="bg-white rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-light)]" />
          <span className="text-sm font-medium text-[var(--text-dark)]">
            Filter by Process
          </span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Active filter indicator */}
      {hasActiveFilters && (
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
          <span className="text-xs text-blue-700">
            Active: {getActiveFilterText()}
          </span>
        </div>
      )}

      {/* Tier 1: Process Types */}
      <div className="max-h-[400px] overflow-y-auto">
        {tieredData.processTypes.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[var(--text-light)] text-center">
            No process types found
          </div>
        ) : (
          tieredData.processTypes.map((processType) => {
            const isExpanded = expandedProcessType === processType.value;
            const isSelected = selectedFilters.processType === processType.value;
            const processColor = getProcessTypeColor(processType.value);

            return (
              <div key={processType.value}>
                {/* Tier 1 Item */}
                <button
                  onClick={() => handleProcessTypeClick(processType.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-l-2 border-l-blue-500"
                      : "hover:bg-gray-50 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-light)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-light)]" />
                    )}
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: processColor }}
                    />
                    <span className="text-sm font-medium text-[var(--text-dark)]">
                      {processType.label}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-light)] bg-gray-100 px-2 py-0.5 rounded-full">
                    {processType.count}
                  </span>
                </button>

                {/* Tier 2: Primary Categories (Basic OE / Envelope Size) */}
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {(tieredData.primaryCategories.get(processType.value) || []).length === 0 ? (
                      <div className="px-8 py-2 text-xs text-[var(--text-light)]">
                        No envelope sizes found
                      </div>
                    ) : (
                      (tieredData.primaryCategories.get(processType.value) || []).map(
                        (primaryCategory) => {
                          const isPrimaryCategoryExpanded =
                            expandedPrimaryCategory === primaryCategory.value;
                          const isPrimaryCategorySelected =
                            selectedFilters.primaryCategory === primaryCategory.value;
                          const categoryKey = `${processType.value}:${primaryCategory.value}`;
                          const subCategoryData = tieredData.subCategories.get(categoryKey);

                          return (
                            <div key={primaryCategory.value}>
                              {/* Tier 2 Item */}
                              <button
                                onClick={() =>
                                  handlePrimaryCategoryClick(primaryCategory.value)
                                }
                                className={`w-full flex items-center justify-between px-6 py-2 text-left transition-colors ${
                                  isPrimaryCategorySelected
                                    ? "bg-blue-100"
                                    : "hover:bg-gray-100"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {subCategoryData && subCategoryData.size > 0 ? (
                                    isPrimaryCategoryExpanded ? (
                                      <ChevronDown className="w-3 h-3 text-[var(--text-light)]" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 text-[var(--text-light)]" />
                                    )
                                  ) : (
                                    <span className="w-3 h-3" />
                                  )}
                                  <span className="text-sm text-[var(--text-dark)]">
                                    {primaryCategory.label}
                                  </span>
                                </div>
                                <span className="text-xs text-[var(--text-light)] bg-gray-200 px-2 py-0.5 rounded-full">
                                  {primaryCategory.count}
                                </span>
                              </button>

                              {/* Tier 3: Sub-categories */}
                              {isPrimaryCategoryExpanded && subCategoryData && (
                                <div className="bg-gray-100 border-t border-gray-200 py-1">
                                  {Array.from(subCategoryData.entries()).map(
                                    ([fieldName, values]) => {
                                      const subFields = getSubCategoryFields(processType.value);
                                      const fieldConfig = subFields.find(
                                        (f) => f.name === fieldName
                                      );
                                      const fieldLabel = fieldConfig?.label || fieldName;

                                      return (
                                        <div key={fieldName} className="px-9 py-1">
                                          <div className="text-xs font-medium text-[var(--text-light)] uppercase tracking-wide mb-1">
                                            {fieldLabel}
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {values.map((item) => {
                                              const isItemSelected = isSubCategorySelected(
                                                fieldName,
                                                item.value
                                              );
                                              return (
                                                <button
                                                  key={item.value}
                                                  onClick={() =>
                                                    handleSubCategoryClick(fieldName, item.value)
                                                  }
                                                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                                    isItemSelected
                                                      ? "bg-blue-500 text-white"
                                                      : "bg-white text-[var(--text-dark)] hover:bg-gray-200 border border-gray-200"
                                                  }`}
                                                >
                                                  {item.value}{" "}
                                                  <span
                                                    className={
                                                      isItemSelected
                                                        ? "text-blue-200"
                                                        : "text-[var(--text-light)]"
                                                    }
                                                  >
                                                    ({item.count})
                                                  </span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
