/**
 * Step 4: Machine Groups & Rules Configuration
 * Allows joining/creating machine groups and adding rules
 */

"use client";

import React, { useEffect, useState } from "react";
import MachineGroupSelector from "../MachineGroupSelector";
import RuleCreationForm from "./RuleCreationForm";
import type { RuleFormData } from "@/hooks/useWizardState";
import {
  getVariableCombinations,
  deleteVariableCombination,
} from "@/lib/api";
import { Trash2 } from "lucide-react";

interface StepGroupsAndRulesProps {
  // Group state
  machineGroupOption: "none" | "existing" | "new";
  existingGroupId: number | null;
  newGroupName: string;
  newGroupDescription: string;
  processTypeKey: string;
  facilitiesId: number | null;
  machineVariablesId: number | null;

  // Rules state
  rules: RuleFormData[];

  // Group handlers
  onSelectGroupOption: (option: "none" | "existing" | "new") => void;
  onSelectExistingGroup: (groupId: number) => void;
  onSetNewGroupName: (name: string) => void;
  onSetNewGroupDescription: (description: string) => void;

  // Rules handlers
  onAddRule: (rule: RuleFormData) => void;
  onRemoveRule: (index: number) => void;

  // Errors
  errors: Record<string, string>;
}

// Helper function to transform operator from Title Case to snake_case
const transformOperatorFromAPI = (operator: string): string => {
  const operatorMap: Record<string, string> = {
    "Equals": "equals",
    "Not Equals": "not_equals",
    "Greater Than": "greater_than",
    "Less Than": "less_than",
    "Greater Than Or Equal": "greater_than_or_equal",
    "Less Than Or Equal": "less_than_or_equal",
    "Between": "between",
    "In": "in",
    "Not In": "not_in",
  };
  return operatorMap[operator] || operator.toLowerCase().replace(/\s+/g, "_");
};

// Transform API conditions to RuleFormData format
const transformConditionsFromAPI = (conditions: any[]): RuleFormData["conditions"] => {
  return conditions.map((cond, index) => {
    const transformed: any = {
      parameter: cond.field,
      operator: transformOperatorFromAPI(cond.operator),
      value: cond.value,
    };
    // If there's a logicalOperator, it applies to the next condition
    // So we set the logic on the current condition
    if (cond.logicalOperator) {
      transformed.logic = cond.logicalOperator as "AND" | "OR";
    } else if (index > 0) {
      // Default to AND if no logicalOperator is specified
      transformed.logic = "AND" as "AND" | "OR";
    }
    return transformed;
  });
};

export default function StepGroupsAndRules({
  machineGroupOption,
  existingGroupId,
  newGroupName,
  newGroupDescription,
  processTypeKey,
  facilitiesId,
  machineVariablesId,
  rules,
  onSelectGroupOption,
  onSelectExistingGroup,
  onSetNewGroupName,
  onSetNewGroupDescription,
  onAddRule,
  onRemoveRule,
  errors,
}: StepGroupsAndRulesProps) {
  const [existingRules, setExistingRules] = useState<
    Array<RuleFormData & { id?: number }>
  >([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);

  // Fetch existing rules from API when machineVariablesId is available
  const fetchExistingRules = async () => {
    if (!machineVariablesId) {
      setExistingRules([]);
      return;
    }

    setIsLoadingRules(true);
    try {
      console.log(
        "[StepGroupsAndRules] Fetching existing rules for machine_variables_id:",
        machineVariablesId,
      );
      const apiRules = await getVariableCombinations(machineVariablesId);
      
      // Transform API rules to RuleFormData format, preserving the ID
      const transformedRules: Array<RuleFormData & { id?: number }> = apiRules.map(
        (apiRule, index) => ({
          id: apiRule.id || apiRule.variable_combinations_id,
          name: apiRule.rule_name || apiRule.name || "",
          conditions: transformConditionsFromAPI(apiRule.conditions || []),
          outputs: {
            speed_modifier: apiRule.speed_modifier || 100,
            people_required: apiRule.people_required || 1,
            fixed_rate: apiRule.fixed_rate,
            notes: apiRule.notes || "",
          },
          priority: index + 1,
        }),
      );

      console.log(
        "[StepGroupsAndRules] Transformed",
        transformedRules.length,
        "rules from API",
      );
      setExistingRules(transformedRules);
    } catch (error) {
      console.error("[StepGroupsAndRules] Error fetching existing rules:", error);
      setExistingRules([]);
    } finally {
      setIsLoadingRules(false);
    }
  };

  useEffect(() => {
    fetchExistingRules();
  }, [machineVariablesId]);

  // Handle adding a new rule - refresh existing rules after successful save
  const handleAddRule = async (rule: RuleFormData) => {
    // Add to local state first (for immediate UI feedback)
    onAddRule(rule);
    // Refresh existing rules from API to get the newly saved rule
    // This ensures we have the latest data and avoid duplicates
    setTimeout(() => {
      fetchExistingRules();
    }, 500); // Small delay to ensure API has processed the new rule
  };

  // Handle deleting a rule
  const handleDeleteRule = async (index: number, ruleId?: number) => {
    // If it's an existing rule from API, delete it via API
    if (ruleId !== undefined && index < existingRules.length) {
      setDeletingRuleId(ruleId);
      try {
        console.log(
          "[StepGroupsAndRules] Deleting rule from API:",
          ruleId,
        );
        await deleteVariableCombination(ruleId);
        // Refresh existing rules to reflect the deletion
        await fetchExistingRules();
      } catch (error) {
        console.error("[StepGroupsAndRules] Error deleting rule:", error);
        alert("Failed to delete rule. Please try again.");
      } finally {
        setDeletingRuleId(null);
      }
    } else {
      // If it's a local rule, just remove it from local state
      onRemoveRule(index - existingRules.length);
    }
  };

  // Format conditions for display
  const formatConditions = (conditions: RuleFormData["conditions"]): string => {
    if (conditions.length === 0) return "No conditions";
    return conditions
      .map((cond, index) => {
        const prefix = index > 0 ? ` ${cond.logic || "AND"} ` : "";
        return `${prefix}${cond.parameter} ${cond.operator} ${cond.value}`;
      })
      .join("");
  };

  // Combine existing rules from API with locally added rules
  // Filter out duplicates (rules that are already in existingRules)
  const allRules = [
    ...existingRules,
    ...rules.filter(
      (localRule) =>
        !existingRules.some(
          (existingRule) => existingRule.name === localRule.name,
        ),
    ),
  ];

  return (
    <div className="space-y-8">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Machine Groups & Rules
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Optionally organize this machine into a group and define rules for how
          parameters affect performance.
        </p>
      </div>

      {/* Machine Groups Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Machine Groups
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Group machines together to share common rules and configurations. This
          is optional but recommended for machines with similar characteristics.
        </p>

        <MachineGroupSelector
          selectedOption={machineGroupOption}
          existingGroupId={existingGroupId}
          newGroupName={newGroupName}
          newGroupDescription={newGroupDescription}
          processTypeKey={processTypeKey}
          facilitiesId={facilitiesId}
          onSelectOption={onSelectGroupOption}
          onSelectExistingGroup={onSelectExistingGroup}
          onSetNewGroupName={onSetNewGroupName}
          onSetNewGroupDescription={onSetNewGroupDescription}
          errors={errors}
        />
      </div>

      {/* Rules Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Rules Configuration
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Define rules that control how machine parameters affect speed and
          staffing. Rules are optional but useful for modeling complex behavior.
        </p>

        {/* Info about where rules apply */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 text-sm text-blue-800">
              {machineGroupOption === "none" ? (
                <p>
                  <strong>Rules for this machine only:</strong> Rules you create
                  here will apply only to this specific machine.
                </p>
              ) : machineGroupOption === "existing" ? (
                <p>
                  <strong>Shared group rules:</strong> Rules you create here
                  will apply to all machines in the selected group.
                </p>
              ) : (
                <p>
                  <strong>New group rules:</strong> Rules you create here will
                  apply to all machines in your new group.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Existing Rules List */}
        {isLoadingRules && (
          <div className="mb-4 text-sm text-gray-500">Loading existing rules...</div>
        )}
        
        {allRules.length > 0 && (
          <div className="mb-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">
              Current Rules ({allRules.length})
              {existingRules.length > 0 && (
                <span className="text-xs text-gray-500 ml-2">
                  ({existingRules.length} from server, {rules.length} new)
                </span>
              )}
            </h4>
            {allRules.map((rule, index) => {
              const isExistingRule = index < existingRules.length;
              const ruleId = isExistingRule
                ? (rule as RuleFormData & { id?: number }).id
                : undefined;
              const isDeleting = deletingRuleId === ruleId;

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-3 flex items-start justify-between gap-3 ${
                    isExistingRule
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50 border-gray-200"
                  } ${isDeleting ? "opacity-50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {rule.name}
                      </span>
                      {isExistingRule && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Saved
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>When:</strong> {formatConditions(rule.conditions)}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Speed: {rule.outputs.speed_modifier}%</span>
                      <span>People: {rule.outputs.people_required}</span>
                      {rule.outputs.fixed_rate && (
                        <span>Fixed Rate: {rule.outputs.fixed_rate}</span>
                      )}
                      {rule.outputs.notes && (
                        <span className="truncate">
                          Note: {rule.outputs.notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(index, ruleId)}
                    disabled={isDeleting}
                    className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isDeleting ? "Deleting..." : "Delete rule"}
                  >
                    {isDeleting ? (
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Rule Creation Form */}
        <RuleCreationForm
          processTypeKey={processTypeKey}
          machineVariablesId={machineVariablesId}
          onAddRule={handleAddRule}
          existingRules={allRules}
        />

        {/* Help Text */}
        {allRules.length === 0 && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 text-sm text-gray-600">
                <strong>Optional:</strong> Rules let you define how machine
                parameters (like envelope size, pockets, etc.) affect speed and
                staffing requirements. You can skip this step and add rules
                later if needed.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rule Errors */}
      {Object.keys(errors).some((key) => key.startsWith("rule_")) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">
            <strong>Rule Validation Errors:</strong> Please review the rules
            above for issues.
          </p>
        </div>
      )}
    </div>
  );
}
