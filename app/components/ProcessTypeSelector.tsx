/**
 * Process Type Selector Component
 * Allows selecting existing process type or creating a custom one
 */

"use client";

import React, { useState, useEffect } from "react";
import { getAllMachineVariables, getMachineVariablesById } from "@/lib/api";
import { Pen, Trash2 } from "lucide-react";

interface ProcessTypeSelectorProps {
  selectedProcessType: string;
  isCustom: boolean;
  customName: string;
  onSelectExisting: (key: string) => void;
  onSelectCustom: (name: string) => void;
  onCancelCustom: () => void;
  onEditField?: (fieldLabel: string) => void;
  onDeleteField?: (processTypeKey: string, fieldName: string) => void;
  error?: string;
}

interface MachineVariableGroup {
  id?: number;
  type: string;
  variables: any[];
}

export default function ProcessTypeSelector({
  selectedProcessType,
  isCustom,
  customName,
  onSelectExisting,
  onSelectCustom,
  onCancelCustom,
  onEditField,
  onDeleteField,
  error,
}: ProcessTypeSelectorProps) {
  const [showCustomForm, setShowCustomForm] = useState(isCustom);
  const [customNameInput, setCustomNameInput] = useState(customName);
  const [variableCounts, setVariableCounts] = useState<Record<string, number>>(
    {},
  );
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [apiProcessTypes, setApiProcessTypes] = useState<
    Array<{ key: string; label: string; color: string }>
  >([]);
  const [expandedProcessType, setExpandedProcessType] = useState<string | null>(
    null,
  );
  const [processTypeToIdMap, setProcessTypeToIdMap] = useState<
    Record<string, number>
  >({});
  const [expandedVariables, setExpandedVariables] = useState<
    Record<string, any[]>
  >({});
  const [loadingVariables, setLoadingVariables] = useState<
    Record<string, boolean>
  >({});

  // Fetch machine variables and group by type
  useEffect(() => {
    const fetchVariableCounts = async () => {
      try {
        setLoadingCounts(true);
        const allVariables = await getAllMachineVariables();

        // Deprecated process types to filter out
        const deprecatedTypes = [
          "insert9to12",
          "9-12 in+",
          "insert13plus",
          "13+ in+",
          "sort",
          "hp press",
          "hp-press",
          "label/apply",
          "labelapply",
          "affix glue+",
          "affix label+",
          "ink jet+",
          "inkjet+",
          "insert+",
        ];

        // Group by type and count variables, collect ALL process types from API
        const counts: Record<string, number> = {};
        const apiTypes: Array<{ key: string; label: string; color: string }> =
          [];

        const idMap: Record<string, number> = {};

        allVariables.forEach((group: MachineVariableGroup) => {
          if (group.type) {
            // Skip deprecated process types
            const normalizedType = group.type.toLowerCase().trim();
            if (deprecatedTypes.some(dep => dep.toLowerCase() === normalizedType)) {
              console.log(`[ProcessTypeSelector] Filtering out deprecated process type: ${group.type}`);
              return;
            }

            // Store the ID mapping
            if (group.id) {
              idMap[group.type] = group.id;
            }

            // Count variables
            if (Array.isArray(group.variables)) {
              counts[group.type] = group.variables.length;
            } else if (group.variables && typeof group.variables === "object") {
              // Handle case where variables is an object (empty {} or object with keys)
              counts[group.type] = Object.keys(group.variables).length;
            } else {
              counts[group.type] = 0;
            }

            // Add all process types from API - use database values for label and color
            // Fallback to computed values if not yet migrated
            if (!apiTypes.find((t) => t.key === group.type)) {
              apiTypes.push({
                key: group.type,
                label: (group as any).label || group.type.charAt(0).toUpperCase() + group.type.slice(1),
                color: (group as any).color || "#6B7280", // Gray fallback
              });
            }
          }
        });

        setVariableCounts(counts);
        setApiProcessTypes(apiTypes);
        setProcessTypeToIdMap(idMap);
      } catch (error) {
        console.error(
          "[ProcessTypeSelector] Error fetching variable counts:",
          error,
        );
      } finally {
        setLoadingCounts(false);
      }
    };

    fetchVariableCounts();
  }, []);

  // Fetch variables when a process type is expanded
  useEffect(() => {
    if (!expandedProcessType || !processTypeToIdMap[expandedProcessType]) {
      return;
    }

    // Check if we already have the variables for this process type
    if (expandedVariables[expandedProcessType]) {
      return;
    }

    const fetchVariables = async () => {
      const machineVariablesId = processTypeToIdMap[expandedProcessType];
      if (!machineVariablesId) {
        return;
      }

      setLoadingVariables((prev) => ({ ...prev, [expandedProcessType]: true }));

      try {
        const machineVariablesData = await getMachineVariablesById(
          machineVariablesId,
        );

        // Extract variables from the response
        let variables: any[] = [];
        if (
          machineVariablesData.variables &&
          typeof machineVariablesData.variables === "object"
        ) {
          if (Array.isArray(machineVariablesData.variables)) {
            variables = machineVariablesData.variables;
          } else {
            // Convert object to array format
            variables = Object.entries(machineVariablesData.variables).map(
              ([key, value]) => {
                const val = value as any;
                return {
                  fieldName: key,
                  fieldLabel: val.label || key,
                  fieldType: val.type || "text",
                  fieldValue: typeof val === "object" ? val.value : val,
                  options: val.options,
                  required: val.required || false,
                };
              },
            );
          }
        }

        setExpandedVariables((prev) => ({
          ...prev,
          [expandedProcessType]: variables,
        }));
      } catch (error) {
        console.error(
          "[ProcessTypeSelector] Error fetching variables:",
          error,
        );
        setExpandedVariables((prev) => ({
          ...prev,
          [expandedProcessType]: [],
        }));
      } finally {
        setLoadingVariables((prev) => ({
          ...prev,
          [expandedProcessType]: false,
        }));
      }
    };

    fetchVariables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedProcessType, processTypeToIdMap]);

  const handleCreateCustom = () => {
    setShowCustomForm(true);
  };

  const handleSaveCustom = () => {
    if (customNameInput.trim()) {
      onSelectCustom(customNameInput.trim());
      setShowCustomForm(false);
    }
  };

  const handleCancelCustom = () => {
    setShowCustomForm(false);
    setCustomNameInput("");
    onCancelCustom();
  };

  const selectedApiType = apiProcessTypes.find(
    (t) => t.key === selectedProcessType,
  );
  const selectedTypeLabel =
    selectedApiType?.label || selectedProcessType.charAt(0).toUpperCase() + selectedProcessType.slice(1);
  const selectedTypeColor =
    selectedApiType?.color || "#6B7280";
  const selectedTypeFieldCount =
    variableCounts[selectedProcessType] ?? 0;

  return (
    <div className="space-y-4">
      {/* Existing Process Types */}
      {!showCustomForm && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Existing Process Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loadingCounts ? (
              <div className="col-span-full text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">
                  Loading process types...
                </p>
              </div>
            ) : apiProcessTypes.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-sm text-gray-500">
                  No process types found in the system.
                </p>
              </div>
            ) : (
              apiProcessTypes.map((apiType) => {
                const isExpanded = expandedProcessType === apiType.key;
                const isSelected =
                  selectedProcessType === apiType.key && !isCustom;

                return (
                  <div
                    key={apiType.key}
                    className={`rounded-lg border-2 transition-all ${
                      isExpanded ? "col-span-full" : ""
                    } ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectExisting(apiType.key);
                        setExpandedProcessType(isExpanded ? null : apiType.key);
                      }}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: apiType.color }}
                        />
                        <span className="font-medium text-gray-900">
                          {apiType.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {variableCounts[apiType.key] !== undefined
                          ? `${variableCounts[apiType.key]} fields configured`
                          : "0 fields configured"}
                      </p>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-200 pt-3">
                        {loadingVariables[apiType.key] ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-xs text-gray-500">
                              Loading variables...
                            </p>
                          </div>
                        ) : expandedVariables[apiType.key] &&
                          expandedVariables[apiType.key].length > 0 ? (
                          <div className="space-y-2">
                            {expandedVariables[apiType.key].map(
                              (variable: any, index: number) => {
                                const fieldLabel =
                                  variable.fieldLabel ||
                                  variable.variable_label ||
                                  variable.label ||
                                  variable.fieldName ||
                                  variable.variable_name ||
                                  `Field ${index + 1}`;
                                const fieldType =
                                  variable.fieldType ||
                                  variable.variable_type ||
                                  variable.type ||
                                  "text";
                                const fieldName =
                                  variable.fieldName ||
                                  variable.variable_name ||
                                  "";

                                return (
                                  <div
                                    key={index}
                                    className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {fieldLabel}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {fieldName || fieldLabel} | Type:{" "}
                                        {fieldType}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        className="p-1 text-blue-500 hover:text-blue-700"
                                        title="Edit"
                                        onClick={() => onEditField?.(fieldLabel)}
                                      >
                                        <Pen className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        className="p-1 text-red-500 hover:text-red-700"
                                        title="Remove"
                                        onClick={() => {
                                          if (onDeleteField && fieldName) {
                                            onDeleteField(apiType.key, fieldName);
                                            // Remove from local state to update UI immediately
                                            setExpandedVariables((prev) => ({
                                              ...prev,
                                              [apiType.key]: (prev[apiType.key] || []).filter(
                                                (v: any) =>
                                                  (v.fieldName || v.variable_name) !== fieldName
                                              ),
                                            }));
                                            // Update count
                                            setVariableCounts((prev) => ({
                                              ...prev,
                                              [apiType.key]: Math.max(0, (prev[apiType.key] || 0) - 1),
                                            }));
                                          }
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm text-gray-500">
                            No variables configured for this process type
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Selected Process Type Display */}
      {selectedProcessType && !isCustom && !showCustomForm && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium text-green-900">
              {selectedTypeLabel} Selected
            </span>
          </div>
          <p className="text-sm text-green-700">
            This machine will use the {selectedTypeLabel} process type with{" "}
            {selectedTypeFieldCount} pre-configured fields.
          </p>
        </div>
      )}

      {/* Custom Process Type Display */}
      {isCustom && customName && !showCustomForm && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <svg
                  className="w-5 h-5 text-purple-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                <span className="font-medium text-purple-900">
                  Custom: {customName}
                </span>
              </div>
              <p className="text-sm text-purple-700">
                Custom process type - you&apos;ll configure fields in the next
                step
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomForm(true)}
              className="text-purple-600 hover:text-purple-800"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Divider */}
      {!showCustomForm && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">OR</span>
          </div>
        </div>
      )}

      {/* Custom Process Type Form */}
      {showCustomForm ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">
              Create Custom Process Type
            </h3>
            <button
              type="button"
              onClick={handleCancelCustom}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div>
            <label
              htmlFor="customName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Process Type Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="customName"
              value={customNameInput}
              onChange={(e) => setCustomNameInput(e.target.value)}
              placeholder="e.g., Specialty Coating, Custom Assembly"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> After creating a custom process type,
              you&apos;ll be able to define custom fields and capabilities for
              this machine in the next step.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveCustom}
            disabled={!customNameInput.trim()}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Use Custom Process Type
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCreateCustom}
          className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Custom Process Type
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
