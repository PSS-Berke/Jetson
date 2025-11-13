/**
 * Hook for evaluating machine rules
 * Provides real-time speed and staffing calculations based on job parameters
 */

import { useState, useEffect } from "react";
import type { Machine, RuleEvaluationResult } from "@/types";
import {
  evaluateRulesForMachine,
  evaluateRulesForMachineObject,
} from "@/lib/rulesEngine";

/**
 * Evaluate rules for a machine with given parameters
 * Returns loading state and evaluation result
 */
export function useRulesEvaluation(
  machine: Machine | null,
  parameters: Record<string, any>,
): {
  result: RuleEvaluationResult | null;
  loading: boolean;
  error: Error | null;
} {
  const [result, setResult] = useState<RuleEvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const evaluate = async () => {
      if (!machine) {
        setResult(null);
        return;
      }

      // Skip if parameters are empty or invalid
      if (!parameters || Object.keys(parameters).length === 0) {
        setResult(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const evaluation = await evaluateRulesForMachineObject(
          machine,
          parameters,
        );
        setResult(evaluation);
      } catch (err) {
        console.error("[useRulesEvaluation] Error evaluating rules:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setResult(null);
      } finally {
        setLoading(false);
      }
    };

    evaluate();
  }, [machine, parameters]);

  return { result, loading, error };
}

/**
 * Evaluate rules for a process type with given parameters
 * Useful when you don't have a specific machine object yet
 */
export function useRulesEvaluationByProcessType(
  processTypeKey: string | null,
  baseSpeed: number,
  parameters: Record<string, any>,
): {
  result: RuleEvaluationResult | null;
  loading: boolean;
  error: Error | null;
} {
  const [result, setResult] = useState<RuleEvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const evaluate = async () => {
      if (!processTypeKey || !baseSpeed) {
        setResult(null);
        return;
      }

      // Skip if parameters are empty or invalid
      if (!parameters || Object.keys(parameters).length === 0) {
        setResult(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const evaluation = await evaluateRulesForMachine(
          processTypeKey,
          baseSpeed,
          parameters,
        );
        setResult(evaluation);
      } catch (err) {
        console.error(
          "[useRulesEvaluationByProcessType] Error evaluating rules:",
          err,
        );
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setResult(null);
      } finally {
        setLoading(false);
      }
    };

    evaluate();
  }, [processTypeKey, baseSpeed, parameters]);

  return { result, loading, error };
}
