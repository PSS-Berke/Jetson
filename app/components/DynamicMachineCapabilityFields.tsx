'use client';

import React from 'react';
import { getProcessTypeConfig, getProcessTypeOptions, type FieldConfig } from '@/lib/processTypeConfig';
import { MachineCapabilityValue } from '@/types';

interface DynamicMachineCapabilityFieldsProps {
  processTypeKey: string;
  capabilities: {
    [key: string]: MachineCapabilityValue;
  };
  onChange: (field: string, value: MachineCapabilityValue) => void;
  onProcessTypeChange: (processTypeKey: string) => void;
  errors?: Record<string, string>;
  minimalMode?: boolean;
}

export default function DynamicMachineCapabilityFields({
  processTypeKey,
  capabilities,
  onChange,
  onProcessTypeChange,
  errors = {},
  minimalMode = false,
}: DynamicMachineCapabilityFieldsProps) {
  const processConfig = getProcessTypeConfig(processTypeKey);
  const processTypeOptions = getProcessTypeOptions();

  /**
   * Convert a field from job requirements to machine capability field
   * For dropdowns, machines need to support multiple options (multi-select)
   * For numbers, we need min/max capabilities
   */
  const renderCapabilityField = (field: FieldConfig) => {
    const fieldId = `${field.name}-${Date.now()}`;

    const baseInputClasses = `w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      errors[field.name]
        ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:ring-blue-200 focus:border-[var(--primary-blue)]'
    }`;

    // Skip price_per_m - that's job-specific, not machine capability
    if (field.name === 'price_per_m') {
      return null;
    }

    switch (field.type) {
      case 'dropdown': {
        // For machines, dropdown fields become multi-select (supported options)
        const selectedOptions = (capabilities[`supported_${field.name}s`] as string[]) || [];
        const capabilityFieldName = `supported_${field.name}s`;

        return (
          <div key={field.name} className="flex-1 min-w-[200px]">
            <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-2">
              Supported {field.label}s {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-white shadow-sm">
              {field.options?.map((option) => (
                <label key={option} className="flex items-center space-x-2.5 py-2 hover:bg-gray-50 px-2 rounded cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={(e) => {
                      const newSelected = e.target.checked
                        ? [...selectedOptions, option]
                        : selectedOptions.filter((item) => item !== option);
                      onChange(capabilityFieldName, newSelected);
                    }}
                    className="w-4 h-4 text-[var(--primary-blue)] border-gray-300 rounded focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
            {errors[capabilityFieldName] && (
              <p className="mt-1.5 text-sm text-red-600">{errors[capabilityFieldName]}</p>
            )}
            <p className="mt-1.5 text-xs text-gray-500">
              Select all options this machine supports
            </p>
          </div>
        );
      }

      case 'number': {
        // For number fields, we need min/max capabilities
        const minValue = capabilities[`min_${field.name}`] as number | undefined;
        const maxValue = capabilities[`max_${field.name}`] as number | undefined;

        return (
          <div key={field.name} className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} Range {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor={`${fieldId}-min`} className="block text-xs font-medium text-gray-600 mb-1.5">
                  Min
                </label>
                <input
                  type="number"
                  id={`${fieldId}-min`}
                  value={minValue ?? ''}
                  onChange={(e) => onChange(`min_${field.name}`, parseFloat(e.target.value) || 0)}
                  min={field.validation?.min}
                  max={field.validation?.max}
                  step={field.validation?.step || 1}
                  placeholder="Min"
                  className={baseInputClasses}
                />
              </div>
              <div className="flex-1">
                <label htmlFor={`${fieldId}-max`} className="block text-xs font-medium text-gray-600 mb-1.5">
                  Max
                </label>
                <input
                  type="number"
                  id={`${fieldId}-max`}
                  value={maxValue ?? ''}
                  onChange={(e) => onChange(`max_${field.name}`, parseFloat(e.target.value) || 0)}
                  min={field.validation?.min}
                  max={field.validation?.max}
                  step={field.validation?.step || 1}
                  placeholder="Max"
                  className={baseInputClasses}
                />
              </div>
            </div>
            {(errors[`min_${field.name}`] || errors[`max_${field.name}`]) && (
              <p className="mt-1.5 text-sm text-red-600">
                {errors[`min_${field.name}`] || errors[`max_${field.name}`]}
              </p>
            )}
          </div>
        );
      }

      case 'text':
      default: {
        // Text fields - machines might support specific values
        const value = capabilities[field.name] as string | undefined;

        return (
          <div key={field.name} className="flex-1 min-w-[200px]">
            <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              id={fieldId}
              value={value || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClasses}
            />
            {errors[field.name] && <p className="mt-1.5 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Process Type Selector */}
      <div className="w-full">
        <label htmlFor="process-type" className="block text-sm font-medium text-gray-700 mb-2">
          Process Type <span className="text-red-500">*</span>
        </label>
        <select
          id="process-type"
          value={processTypeKey}
          onChange={(e) => onProcessTypeChange(e.target.value)}
          className={`w-full px-4 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors bg-white ${
            errors.process_type_key
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:ring-blue-200 focus:border-[var(--primary-blue)]'
          }`}
          required
        >
          <option value="">Select Process Type...</option>
          {processTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.process_type_key && (
          <p className="mt-1.5 text-sm text-red-600 break-words">{errors.process_type_key}</p>
        )}
        <p className="mt-1.5 text-xs text-gray-500 break-words">
          This determines what capabilities this machine can support
        </p>
      </div>

      {/* Dynamic Capability Fields Based on Selected Process Type */}
      {processConfig && (
        <div className="flex flex-wrap gap-5">
          {processConfig.fields.map((field) => renderCapabilityField(field))}
        </div>
      )}

      {/* Help Text */}
      {!processTypeKey && (
        <p className="text-sm text-gray-500 italic break-words bg-gray-50 p-4 rounded-lg border border-gray-200">
          Select a process type to configure machine capabilities
        </p>
      )}
    </div>
  );
}
