/**
 * Rules Engine for Machine Performance Calculation
 * Evaluates rules to determine how job parameters affect machine speed and staffing
 */

import type {
  MachineRule,
  RuleCondition,
  RuleEvaluationResult,
  RuleOperator,
  Machine,
} from "@/types";
import { getMachineRules } from "./api";

/**
 * Evaluate a single condition against job parameters
 * @param condition - The rule condition to evaluate
 * @param parameters - Job parameters (e.g., { paper_size: '10x13', pockets: 8 })
 * @returns true if condition is met, false otherwise
 */
export function evaluateCondition(
  condition: RuleCondition,
  parameters: Record<string, any>,
): boolean {
  const paramValue = parameters[condition.parameter];
  const conditionValue = condition.value;

  // If parameter doesn't exist in job parameters, condition fails
  if (paramValue === undefined || paramValue === null) {
    return false;
  }

  switch (condition.operator) {
    case "equals":
      return paramValue === conditionValue;

    case "not_equals":
      return paramValue !== conditionValue;

    case "greater_than":
      return Number(paramValue) > Number(conditionValue);

    case "less_than":
      return Number(paramValue) < Number(conditionValue);

    case "greater_than_or_equal":
      return Number(paramValue) >= Number(conditionValue);

    case "less_than_or_equal":
      return Number(paramValue) <= Number(conditionValue);

    case "between":
      // conditionValue should be an array [min, max]
      if (Array.isArray(conditionValue) && conditionValue.length === 2) {
        const numValue = Number(paramValue);
        return (
          numValue >= Number(conditionValue[0]) &&
          numValue <= Number(conditionValue[1])
        );
      }
      return false;

    case "in":
      // Check if paramValue is in the conditionValue array
      if (Array.isArray(conditionValue)) {
        return (conditionValue as (string | number)[]).includes(paramValue);
      }
      return false;

    case "not_in":
      // Check if paramValue is NOT in the conditionValue array
      if (Array.isArray(conditionValue)) {
        return !(conditionValue as (string | number)[]).includes(paramValue);
      }
      return false;

    default:
      console.warn(`[rulesEngine] Unknown operator: ${condition.operator}`);
      return false;
  }
}

/**
 * Evaluate all conditions in a rule with AND/OR logic
 * @param conditions - Array of rule conditions
 * @param parameters - Job parameters
 * @returns true if all conditions are met (considering AND/OR logic), false otherwise
 */
export function evaluateConditions(
  conditions: RuleCondition[],
  parameters: Record<string, any>,
): boolean {
  if (conditions.length === 0) {
    return false;
  }

  // Build condition groups based on logic operators
  let currentResult = evaluateCondition(conditions[0], parameters);

  for (let i = 0; i < conditions.length - 1; i++) {
    const condition = conditions[i];
    const nextCondition = conditions[i + 1];
    const logic = condition.logic || "AND"; // Default to AND

    const nextResult = evaluateCondition(nextCondition, parameters);

    if (logic === "OR") {
      currentResult = currentResult || nextResult;
    } else {
      // AND
      currentResult = currentResult && nextResult;
    }
  }

  return currentResult;
}

/**
 * Find all matching rules for given parameters
 * @param rules - Array of all available rules
 * @param parameters - Job parameters
 * @param machineId - Optional machine ID for machine-specific rules
 * @returns Array of matching rules
 */
export function findMatchingRules(
  rules: MachineRule[],
  parameters: Record<string, any>,
  machineId?: number,
): MachineRule[] {
  return rules.filter((rule) => {
    // Skip inactive rules
    if (rule.active === false) {
      return false;
    }

    // If rule is machine-specific, check if it matches the given machine
    if (rule.machine_id !== undefined && rule.machine_id !== null) {
      if (machineId === undefined || rule.machine_id !== machineId) {
        return false;
      }
    }

    // Evaluate conditions
    return evaluateConditions(rule.conditions, parameters);
  });
}

/**
 * Select the most restrictive rule from matching rules
 * Most restrictive = lowest speed modifier
 * @param matchingRules - Array of matching rules
 * @returns The most restrictive rule, or undefined if no rules match
 */
export function selectMostRestrictiveRule(
  matchingRules: MachineRule[],
): MachineRule | undefined {
  if (matchingRules.length === 0) {
    return undefined;
  }

  // Sort by speed_modifier (ascending) and priority (descending for tie-breaking)
  const sorted = [...matchingRules].sort((a, b) => {
    // First, compare speed modifiers (lower = more restrictive)
    const speedDiff = a.outputs.speed_modifier - b.outputs.speed_modifier;
    if (speedDiff !== 0) {
      return speedDiff;
    }

    // If speed modifiers are equal, use priority (higher priority wins)
    return b.priority - a.priority;
  });

  return sorted[0];
}

/**
 * Evaluate rules for a given machine and job parameters
 * @param processTypeKey - Process type (e.g., 'insert', 'fold')
 * @param baseSpeed - Machine's base speed (speed_hr)
 * @param parameters - Job parameters
 * @param machineId - Optional machine ID for machine-specific rules
 * @returns Rule evaluation result with calculated speed and people required
 */
export async function evaluateRulesForMachine(
  processTypeKey: string,
  baseSpeed: number,
  parameters: Record<string, any>,
  machineId?: number,
): Promise<RuleEvaluationResult> {
  try {
    console.log("[rulesEngine] Evaluating rules for:", {
      processTypeKey,
      baseSpeed,
      parameters,
      machineId,
    });

    // Fetch all rules for this process type
    let allRules: MachineRule[] = [];
    try {
      allRules = await getMachineRules(processTypeKey, undefined, true); // Only active rules
      console.log(
        "[rulesEngine] Found",
        allRules.length,
        "active rules for process type",
      );
    } catch (error) {
      console.error("[rulesEngine] Error loading rules:", error);
      console.log("[rulesEngine] Continuing without rules");
    }

    // Find matching rules
    const matchingRules = findMatchingRules(allRules, parameters, machineId);

    console.log("[rulesEngine] Found", matchingRules.length, "matching rules");

    // If no rules match, return base speed with default staffing
    if (matchingRules.length === 0) {
      return {
        calculatedSpeed: baseSpeed,
        peopleRequired: 1, // Default to 1 person
        baseSpeed,
        explanation: "No matching rules found. Using base speed.",
      };
    }

    // Select the most restrictive rule
    const selectedRule = selectMostRestrictiveRule(matchingRules);

    if (!selectedRule) {
      return {
        calculatedSpeed: baseSpeed,
        peopleRequired: 1,
        baseSpeed,
        explanation: "No matching rules found. Using base speed.",
      };
    }

    // Calculate final speed
    const calculatedSpeed =
      (baseSpeed * selectedRule.outputs.speed_modifier) / 100;

    console.log("[rulesEngine] Selected rule:", selectedRule.name);
    console.log(
      "[rulesEngine] Calculated speed:",
      calculatedSpeed,
      "from base:",
      baseSpeed,
    );

    return {
      matchedRule: selectedRule,
      calculatedSpeed: Math.round(calculatedSpeed), // Round to whole number
      peopleRequired: selectedRule.outputs.people_required,
      baseSpeed,
      explanation: `Rule "${selectedRule.name}" applied: ${selectedRule.outputs.speed_modifier}% of base speed (${baseSpeed}/hr) = ${Math.round(calculatedSpeed)}/hr. Requires ${selectedRule.outputs.people_required} people.`,
    };
  } catch (error) {
    console.error("[rulesEngine] Error evaluating rules:", error);
    // Return base speed on error to prevent blocking
    return {
      calculatedSpeed: baseSpeed,
      peopleRequired: 1,
      baseSpeed,
      explanation: "Error evaluating rules. Using base speed.",
    };
  }
}

/**
 * Evaluate rules for a machine object directly
 * Convenience function that extracts necessary data from Machine object
 * @param machine - Machine object
 * @param parameters - Job parameters
 * @returns Rule evaluation result
 */
export async function evaluateRulesForMachineObject(
  machine: Machine,
  parameters: Record<string, any>,
): Promise<RuleEvaluationResult> {
  if (!machine.process_type_key) {
    console.warn(
      "[rulesEngine] Machine has no process_type_key, using base speed",
    );
    return {
      calculatedSpeed: machine.speed_hr,
      peopleRequired: 1,
      baseSpeed: machine.speed_hr,
      explanation: "Machine has no process type. Using base speed.",
    };
  }

  return evaluateRulesForMachine(
    machine.process_type_key,
    machine.speed_hr,
    parameters,
    machine.id,
  );
}

/**
 * Format a condition for display
 * @param condition - Rule condition
 * @returns Human-readable condition string
 */
export function formatCondition(condition: RuleCondition): string {
  const operatorLabels: Record<RuleOperator, string> = {
    equals: "=",
    not_equals: "≠",
    greater_than: ">",
    less_than: "<",
    greater_than_or_equal: "≥",
    less_than_or_equal: "≤",
    between: "between",
    in: "is one of",
    not_in: "is not one of",
  };

  const operatorLabel =
    operatorLabels[condition.operator] || condition.operator;

  let valueStr = "";
  if (Array.isArray(condition.value)) {
    if (condition.operator === "between") {
      valueStr = `${condition.value[0]} and ${condition.value[1]}`;
    } else {
      valueStr = condition.value.join(", ");
    }
  } else {
    valueStr = String(condition.value);
  }

  return `${condition.parameter} ${operatorLabel} ${valueStr}`;
}

/**
 * Format all conditions in a rule for display
 * @param conditions - Array of rule conditions
 * @returns Human-readable conditions string
 */
export function formatConditions(conditions: RuleCondition[]): string {
  if (conditions.length === 0) {
    return "No conditions";
  }

  const parts: string[] = [];
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    parts.push(formatCondition(condition));

    // Add logic operator for all except the last condition
    if (i < conditions.length - 1) {
      const logic = condition.logic || "AND";
      parts.push(logic);
    }
  }

  return parts.join(" ");
}
