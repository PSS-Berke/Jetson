"use client";

import { useState, useMemo } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import type {
  DynamicFieldFilter,
  DynamicFieldDefinition,
  DynamicFieldOperator,
  DynamicFieldFilterValue,
} from "@/types";
import type { ParsedJob } from "@/hooks/useJobs";
import {
  getAvailableFieldsForProcessType,
  getOperatorsForFieldType,
  getDefaultValueForOperator,
  getFieldValueOptions,
  isValidFilter,
} from "@/lib/dynamicFieldFilters";
import { getProcessTypeOptions } from "@/lib/processTypeConfig";

interface DynamicFieldFilterProps {
  filters: DynamicFieldFilter[];
  onChange: (filters: DynamicFieldFilter[]) => void;
  filterLogic: "and" | "or";
  onFilterLogicChange: (logic: "and" | "or") => void;
  jobs: ParsedJob[]; // For extracting actual values
}

export default function DynamicFieldFilterComponent({
  filters,
  onChange,
  filterLogic,
  onFilterLogicChange,
  jobs,
}: DynamicFieldFilterProps) {
  const [availableFields, setAvailableFields] = useState<
    Map<string, DynamicFieldDefinition[]>
  >(new Map());
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());

  // Process type options (excluding Capability Bucket and deprecated types)
  const processTypeOptions = useMemo(() => {
    const deprecatedTypes = ['9-12 in+', 'sort', 'insert +', 'insert+', '13+ in+', '13+'];

    return getProcessTypeOptions().filter((opt) => {
      const normalizedValue = opt.value.toLowerCase().trim();

      // Exclude Capability Bucket
      if (opt.value === "Capability Bucket") return false;

      // Exclude deprecated types
      if (deprecatedTypes.some(dep => dep.toLowerCase() === normalizedValue)) {
        return false;
      }

      return true;
    });
  }, []);

  // Load available fields for a process type
  const loadFieldsForProcessType = async (processType: string) => {
    if (availableFields.has(processType) || loadingFields.has(processType)) {
      return; // Already loaded or loading
    }

    setLoadingFields((prev) => new Set(prev).add(processType));

    try {
      const fields = await getAvailableFieldsForProcessType(processType);
      setAvailableFields((prev) => new Map(prev).set(processType, fields));
    } catch (error) {
      console.error(`Failed to load fields for ${processType}:`, error);
    } finally {
      setLoadingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(processType);
        return newSet;
      });
    }
  };

  // Add a new filter
  const addFilter = () => {
    const newFilter: DynamicFieldFilter = {
      id: `filter_${Date.now()}_${Math.random()}`,
      processType: "",
      fieldName: "",
      fieldLabel: "",
      fieldType: "text",
      operator: "equals",
      value: "",
    };
    onChange([...filters, newFilter]);
  };

  // Remove a filter
  const removeFilter = (filterId: string) => {
    onChange(filters.filter((f) => f.id !== filterId));
  };

  // Update a filter property
  const updateFilter = (
    filterId: string,
    updates: Partial<DynamicFieldFilter>,
  ) => {
    onChange(
      filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
    );
  };

  // Handle process type change
  const handleProcessTypeChange = (filterId: string, processType: string) => {
    loadFieldsForProcessType(processType);
    updateFilter(filterId, {
      processType,
      fieldName: "",
      fieldLabel: "",
      operator: "equals",
      value: "",
    });
  };

  // Handle field change
  const handleFieldChange = (filterId: string, fieldName: string) => {
    const filter = filters.find((f) => f.id === filterId);
    if (!filter) return;

    const fields = availableFields.get(filter.processType);
    const field = fields?.find((f) => f.name === fieldName);

    if (field) {
      const operators = getOperatorsForFieldType(field.type);
      const defaultOperator = operators[0]?.value || "equals";
      const defaultValue = getDefaultValueForOperator(
        defaultOperator,
        field.type,
        field.options,
      );

      updateFilter(filterId, {
        fieldName: field.name,
        fieldLabel: field.label,
        fieldType: field.type,
        operator: defaultOperator,
        value: defaultValue,
        options: field.options,
      });
    }
  };

  // Handle operator change
  const handleOperatorChange = (
    filterId: string,
    operator: DynamicFieldOperator,
  ) => {
    const filter = filters.find((f) => f.id === filterId);
    if (!filter) return;

    const defaultValue = getDefaultValueForOperator(
      operator,
      filter.fieldType,
      filter.options,
    );

    updateFilter(filterId, { operator, value: defaultValue });
  };

  // Handle value change
  const handleValueChange = (filterId: string, value: DynamicFieldFilterValue) => {
    updateFilter(filterId, { value });
  };

  // Render value input based on operator and field type
  const renderValueInput = (filter: DynamicFieldFilter) => {
    // No value needed for these operators
    if (
      filter.operator === "is_empty" ||
      filter.operator === "is_not_empty" ||
      filter.operator === "is_true" ||
      filter.operator === "is_false"
    ) {
      return null;
    }

    // Between operator (range)
    if (filter.operator === "between") {
      const rangeValue =
        typeof filter.value === "object" && filter.value !== null && "min" in filter.value
          ? (filter.value as { min: number; max: number })
          : { min: 0, max: 100 };

      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={rangeValue.min}
            onChange={(e) =>
              handleValueChange(filter.id, {
                ...rangeValue,
                min: Number(e.target.value),
              })
            }
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="Min"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="number"
            value={rangeValue.max}
            onChange={(e) =>
              handleValueChange(filter.id, {
                ...rangeValue,
                max: Number(e.target.value),
              })
            }
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="Max"
          />
        </div>
      );
    }

    // Multi-select operators (in, not_in)
    if (filter.operator === "in" || filter.operator === "not_in") {
      const selectedValues = (Array.isArray(filter.value) ? filter.value : []) as string[];
      const options = filter.options || getFieldValueOptions(jobs, filter.processType, filter.fieldName);

      return (
        <div className="flex flex-wrap gap-1">
          {options.length > 0 ? (
            options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm hover:bg-gray-200"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    const newValues: string[] = e.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((v) => v !== option);
                    handleValueChange(filter.id, newValues);
                  }}
                  className="h-3 w-3"
                />
                <span>{option}</span>
              </label>
            ))
          ) : (
            <span className="text-sm text-gray-500">No options available</span>
          )}
        </div>
      );
    }

    // Dropdown/Select fields with options
    if (
      (filter.fieldType === "dropdown" || filter.fieldType === "select") &&
      filter.options &&
      filter.options.length > 0
    ) {
      return (
        <select
          value={String(filter.value || "")}
          onChange={(e) => handleValueChange(filter.id, e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select value...</option>
          {filter.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    // Boolean fields
    if (filter.fieldType === "boolean") {
      return (
        <select
          value={String(filter.value || "false")}
          onChange={(e) => handleValueChange(filter.id, e.target.value === "true")}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    // Number fields
    if (
      filter.fieldType === "number" ||
      filter.fieldType === "integer" ||
      filter.fieldType === "currency"
    ) {
      return (
        <input
          type="number"
          value={Number(filter.value || 0)}
          onChange={(e) => handleValueChange(filter.id, Number(e.target.value))}
          className="w-32 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Enter number"
          step={filter.fieldType === "integer" ? 1 : 0.01}
        />
      );
    }

    // Text fields (default)
    return (
      <input
        type="text"
        value={String(filter.value || "")}
        onChange={(e) => handleValueChange(filter.id, e.target.value)}
        className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Enter value"
      />
    );
  };

  return (
    <div className="space-y-3">
      {/* Filter List - Only shows when there are filters */}
      {filters.length > 0 && (
        <>
          {/* Match All/Any Toggle with Delete All - Shows above filter list */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChange([])}
              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Delete all dynamic field filters"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-500">Match:</span>
            <button
              onClick={() => onFilterLogicChange("and")}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                filterLogic === "and"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => onFilterLogicChange("or")}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                filterLogic === "or"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Any
            </button>
          </div>

          <div className="space-y-3">
            {filters.map((filter) => {
              const fields = availableFields.get(filter.processType) || [];
              const isLoading = loadingFields.has(filter.processType);
              const operators = filter.fieldType
                ? getOperatorsForFieldType(filter.fieldType)
                : [];

              return (
                <div
                  key={filter.id}
                  className="rounded-lg border border-gray-300 bg-white p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      {/* Row 1: Process Type and Field */}
                      <div className="flex gap-2">
                        {/* Process Type Selector */}
                        <select
                          value={filter.processType}
                          onChange={(e) =>
                            handleProcessTypeChange(filter.id, e.target.value)
                          }
                          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select process type...</option>
                          {processTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        {/* Field Selector */}
                        <select
                          value={filter.fieldName}
                          onChange={(e) => handleFieldChange(filter.id, e.target.value)}
                          disabled={!filter.processType || isLoading}
                          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="">
                            {isLoading
                              ? "Loading fields..."
                              : filter.processType
                                ? "Select field..."
                                : "Select process type first"}
                          </option>
                          {fields.map((field) => (
                            <option key={field.name} value={field.name}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Operator and Value */}
                      {filter.fieldName && (
                        <div className="flex gap-2">
                          {/* Operator Selector */}
                          <select
                            value={filter.operator}
                            onChange={(e) =>
                              handleOperatorChange(
                                filter.id,
                                e.target.value as DynamicFieldOperator,
                              )
                            }
                            className="w-48 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {operators.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>

                          {/* Value Input */}
                          <div className="flex-1">{renderValueInput(filter)}</div>
                        </div>
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="mt-0.5 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove filter"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Filter Button - Compact size */}
      <button
        onClick={addFilter}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-500 hover:text-blue-600 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Dynamic Field
      </button>
    </div>
  );
}
