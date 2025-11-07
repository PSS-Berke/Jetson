'use client';

import React from 'react';
import { getProcessTypeConfig, getProcessTypeOptions, type FieldConfig } from '@/lib/processTypeConfig';

interface DynamicRequirementFieldsProps {
  requirement: {
    process_type: string;
    [key: string]: string | number | undefined;
  };
  onChange: (field: string, value: string | number) => void;
  errors?: Record<string, string>;
}

export default function DynamicRequirementFields({
  requirement,
  onChange,
  errors = {},
}: DynamicRequirementFieldsProps) {
  const processConfig = getProcessTypeConfig(requirement.process_type);
  const processTypeOptions = getProcessTypeOptions();

  const renderField = (field: FieldConfig) => {
    const value = requirement[field.name] || '';
    const error = errors[field.name];
    const fieldId = `${field.name}-${Date.now()}`;

    // Match the styling from AddJobModal/EditJobModal for consistency
    const baseInputClasses = `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      error
        ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]'
    }`;

    switch (field.type) {
      case 'dropdown':
        return (
          <div key={field.name} className="flex-1 min-w-[200px]">
            <label htmlFor={fieldId} className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <select
              id={fieldId}
              value={value as string}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={baseInputClasses}
              required={field.required}
            >
              <option value="">Select {field.label}...</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="flex-1 min-w-[200px]">
            <label htmlFor={fieldId} className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              id={fieldId}
              value={value as number}
              onChange={(e) => onChange(field.name, parseFloat(e.target.value) || 0)}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.validation?.step || 1}
              placeholder={field.placeholder}
              className={baseInputClasses}
              required={field.required}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'currency':
        return (
          <div key={field.name} className="flex-1 min-w-[200px]">
            <label htmlFor={fieldId} className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-gray-500 text-base">$</span>
              </div>
              <input
                type="number"
                id={fieldId}
                value={value as string}
                onChange={(e) => onChange(field.name, e.target.value)}
                min={field.validation?.min || 0}
                step={field.validation?.step || 0.01}
                placeholder={field.placeholder || '0.00'}
                className={`${baseInputClasses} pl-8`}
                required={field.required}
              />
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'text':
      default:
        return (
          <div key={field.name} className="flex-1 min-w-[200px]">
            <label htmlFor={fieldId} className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              id={fieldId}
              value={value as string}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClasses}
              required={field.required}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Process Type Selector */}
      <div className="w-full">
        <label htmlFor="process-type" className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
          Process Type <span className="text-red-500">*</span>
        </label>
        <select
          id="process-type"
          value={requirement.process_type}
          onChange={(e) => onChange('process_type', e.target.value)}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.process_type
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]'
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
        {errors.process_type && (
          <p className="mt-1 text-sm text-red-600">{errors.process_type}</p>
        )}
      </div>

      {/* Dynamic Fields Based on Selected Process Type */}
      {processConfig && (
        <div className="flex flex-wrap gap-4">
          {processConfig.fields.map((field) => renderField(field))}
        </div>
      )}

      {/* Help Text */}
      {!requirement.process_type && (
        <p className="text-sm text-gray-500 italic">
          Select a process type to see relevant fields
        </p>
      )}
    </div>
  );
}
