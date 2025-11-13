/**
 * Rule Creation Form Component
 * Embedded rule creation for the wizard - simplified version
 */

"use client";

import React, { useState, useEffect } from "react";
import type { RuleCondition, RuleOperator, LogicOperator } from "@/types";
import type { RuleFormData } from "@/hooks/useWizardState";
import { PROCESS_TYPE_CONFIGS } from "@/lib/processTypeConfig";
import { getMachineVariablesById, createVariableCombination } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

interface RuleCreationFormProps {
  processTypeKey: string;
  machineVariablesId: number | null;
  onAddRule: (rule: RuleFormData) => void;
  existingRules: RuleFormData[];
}

const OPERATOR_OPTIONS: { value: RuleOperator; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "greater_than_or_equal", label: "Greater Than or Equal" },
  { value: "less_than_or_equal", label: "Less Than or Equal" },
  { value: "between", label: "Between" },
  { value: "in", label: "Is One Of" },
  { value: "not_in", label: "Is Not One Of" },
];

const PEOPLE_FRACTION_OPTIONS = [0.25, 0.5, 0.75];

// Helper function to transform operator from snake_case to Title Case
const transformOperator = (operator: string): string => {
  const operatorMap: Record<string, string> = {
    equals: "Equals",
    not_equals: "Not Equals",
    greater_than: "Greater Than",
    less_than: "Less Than",
    greater_than_or_equal: "Greater Than Or Equal",
    less_than_or_equal: "Less Than Or Equal",
    between: "Between",
    in: "In",
    not_in: "Not In",
  };
  return operatorMap[operator] || operator;
};

// Helper function to transform RuleFormData conditions to API format
const transformConditions = (conditions: any[]) => {
  return conditions.map((cond, index) => {
    const transformed: any = {
      field: cond.parameter,
      operator: transformOperator(cond.operator),
      value: cond.value,
    };
    // Add logicalOperator based on the previous condition's logic field
    // The logic field on a condition indicates how to combine it with the next condition
    if (index > 0) {
      const previousCondition = conditions[index - 1];
      // Include both AND and OR explicitly
      if (previousCondition.logic) {
        transformed.logicalOperator = previousCondition.logic;
      }
    }
    return transformed;
  });
};

export default function RuleCreationForm({
  processTypeKey,
  machineVariablesId,
  onAddRule,
  existingRules,
}: RuleCreationFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>({
    name: "",
    conditions: [],
    outputs: {
      speed_modifier: 100,
      people_required: 1,
      fixed_rate: undefined,
      notes: "",
    },
    priority: existingRules.length + 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [machineVariables, setMachineVariables] = useState<Record<string, any>>({});
  const [selectedFraction, setSelectedFraction] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [basePeopleRequired, setBasePeopleRequired] = useState<number>(1);

  // Fetch machine variables when machineVariablesId is available
  useEffect(() => {
    const fetchMachineVariables = async () => {
      if (machineVariablesId) {
        try {
          const data = await getMachineVariablesById(machineVariablesId);
          if (data && data.variables && typeof data.variables === "object") {
            setMachineVariables(data.variables);
          }
        } catch (error) {
          console.error("Error fetching machine variables:", error);
        }
      }
    };

    fetchMachineVariables();
  }, [machineVariablesId]);

  const getAvailableParameters = () => {
    const params: Array<{
      value: string;
      label: string;
      type: string;
      options?: string[];
    }> = [];

    // Add parameters from process type config
    if (processTypeKey) {
      const processConfig = PROCESS_TYPE_CONFIGS.find(
        (config) => config.key === processTypeKey,
      );
      if (processConfig?.fields) {
        processConfig.fields.forEach((field) => {
          params.push({
            value: field.name,
            label: field.label,
            type: field.type,
            options: field.options,
          });
        });
      }
    }

    // Add parameters from machine variables (step 3 inputs)
    if (machineVariables && typeof machineVariables === "object") {
      Object.keys(machineVariables).forEach((key) => {
        const variable = machineVariables[key];
        // Only add if not already in params (avoid duplicates)
        if (!params.find((p) => p.value === key)) {
          params.push({
            value: key,
            label: variable.label || key,
            type: variable.type || "text",
            options: variable.options,
          });
        }
      });
    }

    return params;
  };

  const addCondition = () => {
    setFormData((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        {
          parameter: "",
          operator: "equals" as RuleOperator,
          value: "",
          logic: "AND" as LogicOperator,
        },
      ],
    }));
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const updateCondition = (
    index: number,
    field: keyof RuleCondition,
    value: any,
  ) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) =>
        i === index ? { ...cond, [field]: value } : cond,
      ),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Rule name is required";
    }
    if (formData.conditions.length === 0) {
      newErrors.conditions = "At least one condition is required";
    }
    if (
      formData.outputs.speed_modifier <= 0 ||
      formData.outputs.speed_modifier > 200
    ) {
      newErrors.speed_modifier = "Speed modifier must be between 1 and 200";
    }
    if (formData.outputs.people_required <= 0) {
      newErrors.people_required = "People required must be greater than 0";
    }

    formData.conditions.forEach((cond, index) => {
      if (!cond.parameter) {
        newErrors[`condition_${index}_parameter`] = "Parameter is required";
      }
      if (!cond.value && cond.value !== 0) {
        newErrors[`condition_${index}_value`] = "Value is required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddRule = async () => {
    if (!validateForm()) {
      return;
    }

    // Validate machineVariablesId is available
    if (!machineVariablesId) {
      setErrors({
        save: "Machine variables ID is required. Please select a process type in step 3.",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Transform conditions to API format
      const transformedConditions = transformConditions(formData.conditions);
      
      // Calculate people_required: base number + selected fraction
      const peopleRequired = basePeopleRequired + (selectedFraction || 0);
      
      // Prepare rule data for API
      const ruleData = {
        rule_name: formData.name,
        conditions: transformedConditions,
        fixed_rate: formData.outputs.fixed_rate || 0,
        speed_modifier: formData.outputs.speed_modifier,
        people_required: peopleRequired,
        notes: formData.outputs.notes || "",
        machine_variables_id: machineVariablesId,
      };

      console.log(
        "[RuleCreationForm] Saving rule via variable_combinations API:",
        JSON.stringify(ruleData, null, 2),
      );

      // Save rule to API
      await createVariableCombination(ruleData);

      console.log("[RuleCreationForm] Rule saved successfully");

      // Add rule to local state (for display in the wizard)
      onAddRule(formData);

      // Reset form
      setFormData({
        name: "",
        conditions: [],
        outputs: {
          speed_modifier: 100,
          people_required: 1,
          fixed_rate: undefined,
          notes: "",
        },
        priority: existingRules.length + 2,
      });
      setErrors({});
      setSelectedFraction(null);
      setBasePeopleRequired(1);
      setShowForm(false);
    } catch (error: any) {
      console.error("[RuleCreationForm] Error saving rule:", error);
      setErrors({
        save: error.message || "Failed to save rule. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      conditions: [],
      outputs: {
        speed_modifier: 100,
        people_required: 1,
        fixed_rate: undefined,
        notes: "",
      },
      priority: existingRules.length + 1,
    });
    setErrors({});
    setSelectedFraction(null);
    setBasePeopleRequired(1);
    setShowForm(false);
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Rule
      </button>
    );
  }

  const availableParams = getAvailableParameters();

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Create Rule</h4>
        <button
          type="button"
          onClick={handleCancel}
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

      {/* Rule Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rule Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Large Envelope Adjustment"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Conditions <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={addCondition}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Condition
          </button>
        </div>

        {formData.conditions.length === 0 ? (
          <div className="text-sm text-gray-500 italic">
            No conditions added yet
          </div>
        ) : (
          <div className="space-y-3">
            {formData.conditions.map((condition, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
              >
                {index > 0 && (
                  <select
                    value={condition.logic}
                    onChange={(e) =>
                      updateCondition(
                        index,
                        "logic",
                        e.target.value as LogicOperator,
                      )
                    }
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={condition.parameter}
                    onChange={(e) =>
                      updateCondition(index, "parameter", e.target.value)
                    }
                    className="px-2 py-2 border border-gray-300 rounded"
                  >
                    <option value="">Select Parameter</option>
                    {availableParams.map((param) => (
                      <option key={param.value} value={param.value}>
                        {param.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      updateCondition(
                        index,
                        "operator",
                        e.target.value as RuleOperator,
                      )
                    }
                    className="px-2 py-2 border border-gray-300 rounded"
                  >
                    {OPERATOR_OPTIONS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={String(condition.value || "")}
                      onChange={(e) =>
                        updateCondition(index, "value", e.target.value)
                      }
                      placeholder="Value"
                      className="flex-1 px-2 py-2 border border-gray-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="px-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {errors[`condition_${index}_parameter`] && (
                  <p className="text-xs text-red-600">
                    {errors[`condition_${index}_parameter`]}
                  </p>
                )}
                {errors[`condition_${index}_value`] && (
                  <p className="text-xs text-red-600">
                    {errors[`condition_${index}_value`]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {errors.conditions && (
          <p className="mt-1 text-sm text-red-600">{errors.conditions}</p>
        )}
      </div>

      {/* Outputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Speed Modifier (%) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.outputs.speed_modifier}
            onChange={(e) =>
              setFormData({
                ...formData,
                outputs: {
                  ...formData.outputs,
                  speed_modifier: parseFloat(e.target.value),
                },
              })
            }
            min="1"
            max="200"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          {errors.speed_modifier && (
            <p className="mt-1 text-sm text-red-600">{errors.speed_modifier}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            People Required <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={basePeopleRequired}
              onChange={(e) => {
                const newValue = parseFloat(e.target.value) || 0;
                setBasePeopleRequired(newValue);
                // Update formData with base + fraction
                const totalPeople = newValue + (selectedFraction || 0);
                setFormData({
                  ...formData,
                  outputs: {
                    ...formData.outputs,
                    people_required: totalPeople,
                  },
                });
              }}
              min="0"
              step="1"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <div className="flex gap-1">
              {PEOPLE_FRACTION_OPTIONS.map((fraction) => (
                <button
                  key={fraction}
                  type="button"
                  onClick={() => {
                    const newFraction = selectedFraction === fraction ? null : fraction;
                    setSelectedFraction(newFraction);
                    // Update formData with base + selected fraction
                    const totalPeople = basePeopleRequired + (newFraction || 0);
                    setFormData({
                      ...formData,
                      outputs: {
                        ...formData.outputs,
                        people_required: totalPeople,
                      },
                    });
                  }}
                  className={`px-2 py-1 text-xs border rounded transition-colors ${
                    selectedFraction === fraction
                      ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                      : "border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {fraction}
                </button>
              ))}
            </div>
          </div>
          {errors.people_required && (
            <p className="mt-1 text-sm text-red-600">
              {errors.people_required}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fixed Rate
          </label>
          <input
            type="number"
            value={formData.outputs.fixed_rate ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                outputs: {
                  ...formData.outputs,
                  fixed_rate: e.target.value ? parseFloat(e.target.value) : undefined,
                },
              })
            }
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Enter fixed rate"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (Optional)
        </label>
        <textarea
          value={formData.outputs.notes}
          onChange={(e) =>
            setFormData({
              ...formData,
              outputs: { ...formData.outputs, notes: e.target.value },
            })
          }
          placeholder="Additional notes about this rule..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      {/* Save Error */}
      {errors.save && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{errors.save}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleAddRule}
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Add Rule"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
