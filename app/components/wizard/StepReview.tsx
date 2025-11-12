/**
 * Step 5: Review & Submit
 * Displays all collected information with edit capability
 */

'use client';

import React from 'react';
import type { WizardState } from '@/hooks/useWizardState';
import { PROCESS_TYPE_CONFIGS } from '@/lib/processTypeConfig';
import { Edit2 } from 'lucide-react';

interface StepReviewProps {
  state: WizardState;
  onEditStep: (step: number) => void;
  facilities: any[]; // Array of facility objects
}

export default function StepReview({ state, onEditStep, facilities }: StepReviewProps) {
  // Get facility name
  const facility = facilities.find((f) => f.id === state.facilities_id);
  const facilityName = facility?.name || 'Unknown Facility';

  // Get process type config
  const processConfig = PROCESS_TYPE_CONFIGS.find((c) => c.key === state.process_type_key);

  // Format conditions for display
  const formatConditions = (conditions: any[]): string => {
    if (conditions.length === 0) return 'No conditions';
    return conditions
      .map((cond, index) => {
        const prefix = index > 0 ? ` ${cond.logic} ` : '';
        return `${prefix}${cond.parameter} ${cond.operator} ${cond.value}`;
      })
      .join('');
  };

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review & Submit</h2>
        <p className="mt-2 text-sm text-gray-600">
          Review all information before creating the machine. Click any edit button to go back and
          make changes.
        </p>
      </div>

      {/* Section 1: Category */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">1. Machine Category</h3>
          <button
            type="button"
            onClick={() => onEditStep(1)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {state.machineCategory === 'conveyance' ? '🏭' : '🔧'}
            </span>
            <span className="font-medium text-gray-900 capitalize">{state.machineCategory}</span>
          </div>
          <p className="text-sm text-gray-600">
            {state.machineCategory === 'conveyance'
              ? 'Primary production equipment that processes materials'
              : 'Detachable equipment that connects to conveyance machines'}
          </p>
        </div>
      </div>

      {/* Section 2: Basic Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">2. Basic Information</h3>
          <button
            type="button"
            onClick={() => onEditStep(2)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Line Number</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">{state.line}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Machine Name</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">{state.machineName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Facility</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">{facilityName}</dd>
          </div>
        </dl>
      </div>

      {/* Section 3: Process Type & Capabilities */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">3. Process Type & Capabilities</h3>
          <button
            type="button"
            onClick={() => onEditStep(3)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>

        {state.isCustomProcessType ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                Custom
              </div>
              <span className="font-medium text-gray-900">{state.customProcessTypeName}</span>
            </div>
            <p className="text-sm text-gray-600">
              Custom process type - capabilities will be configured through rules and groups
            </p>
          </div>
        ) : processConfig ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: processConfig.color }}
              />
              <span className="font-medium text-gray-900">{processConfig.label}</span>
            </div>

            {Object.keys(state.capabilities).length > 0 ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Configured Capabilities</h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(state.capabilities).map(([key, value]) => {
                    const field = processConfig.fields.find((f) => f.name === key);
                    return (
                      <div key={key}>
                        <dt className="text-sm text-gray-600">{field?.label || key}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-gray-900">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">No capabilities configured</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600 italic">No process type selected</p>
        )}
      </div>

      {/* Section 4: Groups & Rules */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">4. Machine Groups & Rules</h3>
          <button
            type="button"
            onClick={() => onEditStep(4)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>

        {/* Machine Group */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Machine Group</h4>
          {state.machineGroupOption === 'none' ? (
            <p className="text-sm text-gray-600">No group - machine operates independently</p>
          ) : state.machineGroupOption === 'existing' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Will join existing group (ID: {state.existingGroupId})
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-900">{state.newGroupName}</p>
              {state.newGroupDescription && (
                <p className="text-sm text-green-700 mt-1">{state.newGroupDescription}</p>
              )}
              <p className="text-xs text-green-600 mt-2">New group will be created</p>
            </div>
          )}
        </div>

        {/* Rules */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Rules ({state.rules.length})
          </h4>
          {state.rules.length === 0 ? (
            <p className="text-sm text-gray-600 italic">No rules configured</p>
          ) : (
            <div className="space-y-2">
              {state.rules.map((rule, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-gray-900">{rule.name}</span>
                    <span className="text-xs text-gray-500">Priority: {rule.priority}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>When:</strong> {formatConditions(rule.conditions)}
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-700">
                      <strong>Speed:</strong> {rule.outputs.speed_modifier}%
                    </span>
                    <span className="text-gray-700">
                      <strong>People:</strong> {rule.outputs.people_required}
                    </span>
                  </div>
                  {rule.outputs.notes && (
                    <p className="text-xs text-gray-500 mt-2">{rule.outputs.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ready to Submit */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900">Ready to Create Machine</h4>
            <p className="mt-1 text-sm text-blue-800">
              Review all the information above. If everything looks correct, click &quot;Create Machine&quot;
              to save. You can edit any section by clicking the Edit button.
            </p>
          </div>
        </div>
      </div>

      {/* Additional notes */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">What happens next?</h4>
        <ul className="space-y-1 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>The machine will be created with status &quot;Offline&quot;</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>
              {state.machineGroupOption === 'new'
                ? 'A new machine group will be created and this machine added to it'
                : state.machineGroupOption === 'existing'
                ? 'This machine will be added to the selected group'
                : 'This machine will operate independently'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>
              {state.rules.length > 0
                ? `${state.rules.length} rule(s) will be created and associated with the machine`
                : 'No rules will be created (you can add them later)'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>You can edit the machine details, groups, and rules at any time</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
