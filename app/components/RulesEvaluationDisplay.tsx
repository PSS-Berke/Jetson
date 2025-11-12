/**
 * Component to display the results of rules evaluation
 * Shows calculated speed and people required based on job parameters
 */

'use client';

import React from 'react';
import type { RuleEvaluationResult } from '@/types';

interface RulesEvaluationDisplayProps {
  result: RuleEvaluationResult | null;
  loading?: boolean;
  error?: Error | null;
  className?: string;
}

export default function RulesEvaluationDisplay({
  result,
  loading,
  error,
  className = '',
}: RulesEvaluationDisplayProps) {
  if (loading) {
    return (
      <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center gap-2 text-blue-700">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm">Calculating performance...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
        <div className="text-red-700 text-sm">
          <strong>Error:</strong> {error.message}
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const hasRule = !!result.matchedRule;
  const speedChanged = result.calculatedSpeed !== result.baseSpeed;

  return (
    <div
      className={`border rounded-lg p-4 ${className} ${
        hasRule
          ? 'bg-green-50 border-green-200'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {hasRule ? (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        <h4 className={`font-semibold ${hasRule ? 'text-green-900' : 'text-gray-900'}`}>
          {hasRule ? 'Rule Applied' : 'No Rules Applied'}
        </h4>
      </div>

      <div className="space-y-2">
        {/* Speed Information */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Calculated Speed:</span>
          <div className="flex items-center gap-2">
            {speedChanged && (
              <span className="text-xs text-gray-500 line-through">
                {result.baseSpeed}/hr
              </span>
            )}
            <span className={`font-semibold ${hasRule ? 'text-green-700' : 'text-gray-700'}`}>
              {result.calculatedSpeed.toLocaleString()}/hr
            </span>
          </div>
        </div>

        {/* People Required */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">People Required:</span>
          <span className={`font-semibold ${hasRule ? 'text-green-700' : 'text-gray-700'}`}>
            {result.peopleRequired} {result.peopleRequired === 1 ? 'person' : 'people'}
          </span>
        </div>

        {/* Rule Details */}
        {hasRule && result.matchedRule && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <div className="text-xs text-green-800">
              <strong>Rule:</strong> {result.matchedRule.name}
            </div>
            {result.matchedRule.outputs.notes && (
              <div className="text-xs text-green-700 mt-1">
                {result.matchedRule.outputs.notes}
              </div>
            )}
          </div>
        )}

        {/* Explanation */}
        {result.explanation && (
          <div className="mt-2 text-xs text-gray-600 italic">
            {result.explanation}
          </div>
        )}
      </div>
    </div>
  );
}
