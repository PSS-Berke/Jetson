/**
 * Step 3: Process Type & Capabilities Configuration
 * Allows selecting process type and configuring capabilities
 */

'use client';

import React from 'react';
import ProcessTypeSelector from '../ProcessTypeSelector';
import DynamicMachineCapabilityFields from '../DynamicMachineCapabilityFields';
import CustomProcessTypeBuilder from './CustomProcessTypeBuilder';
import type { MachineCapabilityValue } from '@/types';
import type { CustomFormField } from '@/hooks/useWizardState';

interface StepCapabilitiesProps {
  processTypeKey: string;
  isCustomProcessType: boolean;
  customProcessTypeName: string;
  customProcessTypeFields: CustomFormField[];
  capabilities: Record<string, MachineCapabilityValue>;
  onSelectProcessType: (key: string) => void;
  onSelectCustomProcessType: (name: string) => void;
  onCancelCustomProcessType: () => void;
  onSetCustomProcessTypeFields: (fields: CustomFormField[]) => void;
  onCapabilityChange: (field: string, value: MachineCapabilityValue) => void;
  errors: Record<string, string>;
}

export default function StepCapabilities({
  processTypeKey,
  isCustomProcessType,
  customProcessTypeName,
  customProcessTypeFields,
  capabilities,
  onSelectProcessType,
  onSelectCustomProcessType,
  onCancelCustomProcessType,
  onSetCustomProcessTypeFields,
  onCapabilityChange,
  errors,
}: StepCapabilitiesProps) {
  return (
    <div className="space-y-8">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Process Type & Capabilities</h2>
        <p className="mt-2 text-sm text-gray-600">
          Select a process type with pre-configured capabilities, or create a custom one.
        </p>
      </div>

      {/* Process Type Selection */}
      <ProcessTypeSelector
        selectedProcessType={processTypeKey}
        isCustom={isCustomProcessType}
        customName={customProcessTypeName}
        onSelectExisting={onSelectProcessType}
        onSelectCustom={onSelectCustomProcessType}
        onCancelCustom={onCancelCustomProcessType}
        error={errors.process_type_key || errors.customProcessTypeName}
      />

      {/* Capabilities Configuration */}
      {processTypeKey && !isCustomProcessType && (
        <div className="border-t border-gray-200 pt-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Configure Capabilities</h3>
            <p className="mt-1 text-sm text-gray-600">
              Set the specific capabilities for this machine. These values define what this machine
              can handle.
            </p>
          </div>

          <DynamicMachineCapabilityFields
            processTypeKey={processTypeKey}
            capabilities={capabilities}
            onChange={onCapabilityChange}
            onProcessTypeChange={() => {}} // Process type is already selected, no-op
          />

          {errors.capabilities && (
            <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.capabilities}
            </p>
          )}
        </div>
      )}

      {/* Custom Process Type Builder */}
      {isCustomProcessType && customProcessTypeName && (
        <div className="border-t border-gray-200 pt-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Build Custom Form</h3>
            <p className="mt-1 text-sm text-gray-600">
              Define the fields for your custom process type "<strong>{customProcessTypeName}</strong>".
            </p>
          </div>

          <CustomProcessTypeBuilder
            processTypeName={customProcessTypeName}
            fields={customProcessTypeFields}
            onChange={onSetCustomProcessTypeFields}
          />

          {errors.customProcessTypeFields && (
            <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.customProcessTypeFields}
            </p>
          )}
        </div>
      )}

      {/* Help Text */}
      {!processTypeKey && !isCustomProcessType && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
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
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-700">Getting Started</h4>
              <p className="mt-1 text-sm text-gray-600">
                Choose an existing process type to use pre-configured capabilities, or create a
                custom process type if you need specific configurations not available in the
                standard options.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
