/**
 * Step 4: Machine Groups & Rules Configuration
 * Allows joining/creating machine groups and adding rules
 */

'use client';

import React from 'react';
import MachineGroupSelector from '../MachineGroupSelector';
import RuleCreationForm from './RuleCreationForm';
import type { RuleFormData } from '@/hooks/useWizardState';
import { Trash2 } from 'lucide-react';

interface StepGroupsAndRulesProps {
  // Group state
  machineGroupOption: 'none' | 'existing' | 'new';
  existingGroupId: number | null;
  newGroupName: string;
  newGroupDescription: string;
  processTypeKey: string;
  facilitiesId: number | null;

  // Rules state
  rules: RuleFormData[];

  // Group handlers
  onSelectGroupOption: (option: 'none' | 'existing' | 'new') => void;
  onSelectExistingGroup: (groupId: number) => void;
  onSetNewGroupName: (name: string) => void;
  onSetNewGroupDescription: (description: string) => void;

  // Rules handlers
  onAddRule: (rule: RuleFormData) => void;
  onRemoveRule: (index: number) => void;

  // Errors
  errors: Record<string, string>;
}

export default function StepGroupsAndRules({
  machineGroupOption,
  existingGroupId,
  newGroupName,
  newGroupDescription,
  processTypeKey,
  facilitiesId,
  rules,
  onSelectGroupOption,
  onSelectExistingGroup,
  onSetNewGroupName,
  onSetNewGroupDescription,
  onAddRule,
  onRemoveRule,
  errors,
}: StepGroupsAndRulesProps) {
  // Format conditions for display
  const formatConditions = (conditions: RuleFormData['conditions']): string => {
    if (conditions.length === 0) return 'No conditions';
    return conditions
      .map((cond, index) => {
        const prefix = index > 0 ? ` ${cond.logic} ` : '';
        return `${prefix}${cond.parameter} ${cond.operator} ${cond.value}`;
      })
      .join('');
  };

  return (
    <div className="space-y-8">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Machine Groups & Rules</h2>
        <p className="mt-2 text-sm text-gray-600">
          Optionally organize this machine into a group and define rules for how parameters affect
          performance.
        </p>
      </div>

      {/* Machine Groups Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Machine Groups</h3>
        <p className="text-sm text-gray-600 mb-4">
          Group machines together to share common rules and configurations. This is optional but
          recommended for machines with similar characteristics.
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
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Rules Configuration</h3>
        <p className="text-sm text-gray-600 mb-4">
          Define rules that control how machine parameters affect speed and staffing. Rules are
          optional but useful for modeling complex behavior.
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
              {machineGroupOption === 'none' ? (
                <p>
                  <strong>Rules for this machine only:</strong> Rules you create here will apply
                  only to this specific machine.
                </p>
              ) : machineGroupOption === 'existing' ? (
                <p>
                  <strong>Shared group rules:</strong> Rules you create here will apply to all
                  machines in the selected group.
                </p>
              ) : (
                <p>
                  <strong>New group rules:</strong> Rules you create here will apply to all
                  machines in your new group.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Existing Rules List */}
        {rules.length > 0 && (
          <div className="mb-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Current Rules ({rules.length})</h4>
            {rules.map((rule, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{rule.name}</span>
                    <span className="text-xs text-gray-500">Priority: {rule.priority}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>When:</strong> {formatConditions(rule.conditions)}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Speed: {rule.outputs.speed_modifier}%</span>
                    <span>People: {rule.outputs.people_required}</span>
                    {rule.outputs.notes && (
                      <span className="truncate">Note: {rule.outputs.notes}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveRule(index)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remove rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Rule Creation Form */}
        <RuleCreationForm
          processTypeKey={processTypeKey}
          onAddRule={onAddRule}
          existingRules={rules}
        />

        {/* Help Text */}
        {rules.length === 0 && (
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
                <strong>Optional:</strong> Rules let you define how machine parameters (like
                envelope size, pockets, etc.) affect speed and staffing requirements. You can skip
                this step and add rules later if needed.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rule Errors */}
      {Object.keys(errors).some((key) => key.startsWith('rule_')) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">
            <strong>Rule Validation Errors:</strong> Please review the rules above for issues.
          </p>
        </div>
      )}
    </div>
  );
}
