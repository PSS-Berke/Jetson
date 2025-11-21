"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  getProcessTypeOptions,
  type FieldConfig,
} from "@/lib/processTypeConfig";
import { getMachineVariables } from "@/lib/api";

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
  const [dynamicFields, setDynamicFields] = useState<FieldConfig[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const populatedProcessTypeRef = useRef<string | null>(null);
  const processTypeOptions = getProcessTypeOptions();

  // Fetch dynamic fields when process_type changes
  useEffect(() => {
    if (!requirement.process_type) {
      setDynamicFields([]);
      populatedProcessTypeRef.current = null;
      return;
    }

    const fetchFields = async () => {
      setIsLoadingFields(true);
      try {
        console.log(
          "[DynamicRequirementFields] Fetching fields for:",
          requirement.process_type,
        );
        const response = await getMachineVariables(requirement.process_type);

        // Extract fields from the API response
        // Response structure: [{ id, type, variables: { varName: { type, label, value, required, addToJobInput } } }]
        if (response && response.length > 0) {
          const machineVariable = response[0];
          
          // Check if variables exist and is an object
          if (machineVariable.variables && typeof machineVariable.variables === 'object') {
            const variables = machineVariable.variables;
            
            // Filter variables where addToJobInput === true and map to FieldConfig
            const mappedFields: FieldConfig[] = Object.entries(variables)
              .filter(([varName, varConfig]: [string, any]) => {
                // Only include variables where addToJobInput is true
                return varConfig.addToJobInput === true;
              })
              .map(([varName, varConfig]: [string, any]) => {
                // Map variable config to FieldConfig format
                const fieldConfig: FieldConfig = {
                  name: varName,
                  type: varConfig.type === "select" ? "dropdown" : varConfig.type || "text",
                  label: varConfig.label || varName,
                  required: varConfig.required || false,
                  placeholder: varConfig.placeholder,
                  options: varConfig.options,
                  validation: varConfig.validation,
                };
                
                return fieldConfig;
              });
            
            // Pre-populate field values from API response
            // Only populate once per process type change
            if (populatedProcessTypeRef.current !== requirement.process_type) {
              Object.entries(variables).forEach(([varName, varConfig]: [string, any]) => {
                if (varConfig.addToJobInput === true) {
                  // Only set the value if it exists in API and is not already set in requirement
                  const hasValue = varConfig.value !== undefined && 
                    varConfig.value !== null && 
                    varConfig.value !== "";
                  const notAlreadySet = requirement[varName] === undefined || 
                    requirement[varName] === null || 
                    requirement[varName] === "";
                  
                  if (hasValue && notAlreadySet) {
                    onChange(varName, varConfig.value);
                  }
                }
              });
              populatedProcessTypeRef.current = requirement.process_type;
            }

            console.log(
              "[DynamicRequirementFields] Mapped fields:",
              mappedFields,
            );
            setDynamicFields(mappedFields);
          } else {
            // Fallback to static config if API returns no variables
            console.log(
              "[DynamicRequirementFields] No variables found, using static config",
            );
            setDynamicFields([]);
          }
        } else {
          // Fallback to static config if API returns no fields
          console.log(
            "[DynamicRequirementFields] No dynamic fields, using static config",
          );
          setDynamicFields([]);
        }
      } catch (error) {
        console.error(
          "[DynamicRequirementFields] Error fetching fields:",
          error,
        );
        // Fallback to static config on error
        setDynamicFields([]);
      } finally {
        setIsLoadingFields(false);
      }
    };

    fetchFields();
  }, [requirement.process_type]);

  // Only use dynamic fields from API - no fallback to static config
  const fieldsToRender = dynamicFields;

  const renderField = (field: FieldConfig, index: number) => {
    const value = requirement[field.name] || "";
    const error = errors[field.name];
    const fieldId = `${field.name}-${index}-${requirement.process_type}`;
    const fieldKey = `${requirement.process_type}-${field.name}-${index}`;

    // Match the styling from AddJobModal/EditJobModal for consistency
    const baseInputClasses = `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      error
        ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500"
        : "border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]"
    }`;

    switch (field.type) {
      case "dropdown":
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px]">
            <label
              htmlFor={fieldId}
              className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
            >
              {field.label}{" "}
              {field.required && <span className="text-red-500">*</span>}
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

      case "number":
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px]">
            <label
              htmlFor={fieldId}
              className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
            >
              {field.label}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              id={fieldId}
              value={value as number}
              onChange={(e) =>
                onChange(field.name, parseFloat(e.target.value) || 0)
              }
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

      case "currency":
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px]">
            <label
              htmlFor={fieldId}
              className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
            >
              {field.label}{" "}
              {field.required && <span className="text-red-500">*</span>}
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
                placeholder={field.placeholder || "0.00"}
                className={`${baseInputClasses} pl-8`}
                required={field.required}
              />
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case "text":
      default:
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px]">
            <label
              htmlFor={fieldId}
              className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
            >
              {field.label}{" "}
              {field.required && <span className="text-red-500">*</span>}
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
        <label
          htmlFor="process-type"
          className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
        >
          Process Type <span className="text-red-500">*</span>
        </label>
        <select
          id="process-type"
          value={requirement.process_type}
          onChange={(e) => onChange("process_type", e.target.value)}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.process_type
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]"
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
      {isLoadingFields ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-[var(--text-light)]">
            <svg
              className="animate-spin h-5 w-5"
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
            <span>Loading fields...</span>
          </div>
        </div>
      ) : requirement.process_type && fieldsToRender.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {fieldsToRender.map((field, index) => renderField(field, index))}
        </div>
      ) : null}

      {/* Help Text */}
      {!requirement.process_type && !isLoadingFields && (
        <p className="text-sm text-gray-500 italic">
          Select a process type to see relevant fields
        </p>
      )}

      {/* Info badge when using dynamic fields */}
      {dynamicFields.length > 0 && !isLoadingFields && (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>Using dynamic fields from machine configuration</span>
        </div>
      )}
    </div>
  );
}
