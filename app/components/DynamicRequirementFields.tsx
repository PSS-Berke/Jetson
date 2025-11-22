"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  getProcessTypeOptions,
  type FieldConfig,
} from "@/lib/processTypeConfig";
import { getMachineVariables, getCapabilityBuckets, type CapabilityBucket } from "@/lib/api";

interface DynamicRequirementFieldsProps {
  requirement: {
    process_type: string;
    [key: string]: string | number | undefined;
  };
  onChange: (field: string, value: string | number) => void;
  errors?: Record<string, string>;
  disableRequired?: boolean;
}

export default function DynamicRequirementFields({
  requirement,
  onChange,
  errors = {},
  disableRequired = false,
}: DynamicRequirementFieldsProps) {
  const [dynamicFields, setDynamicFields] = useState<FieldConfig[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [capabilityBuckets, setCapabilityBuckets] = useState<CapabilityBucket[]>([]);
  const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);
  const populatedProcessTypeRef = useRef<string | null>(null);
  const populatedBucketRef = useRef<number | null>(null);
  const processTypeOptions = getProcessTypeOptions();

  // Fetch capability buckets when process_type changes
  useEffect(() => {
    if (!requirement.process_type) {
      setCapabilityBuckets([]);
      return;
    }

    const fetchBuckets = async () => {
      setIsLoadingBuckets(true);
      try {
        const buckets = await getCapabilityBuckets();
        setCapabilityBuckets(buckets);
      } catch (error) {
        console.error("[DynamicRequirementFields] Error fetching capability buckets:", error);
        setCapabilityBuckets([]);
      } finally {
        setIsLoadingBuckets(false);
      }
    };

    fetchBuckets();
  }, [requirement.process_type]);

  // Fetch dynamic fields when process_type changes (but not if bucket is selected)
  useEffect(() => {
    if (!requirement.process_type) {
      setDynamicFields([]);
      populatedProcessTypeRef.current = null;
      populatedBucketRef.current = null;
      return;
    }

    // Don't fetch machine_variables if a bucket is selected
    if (requirement.capability_bucket_id) {
      setDynamicFields([]);
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
                // Map variable type to FieldConfig type
                let fieldType: FieldConfig["type"] = "text";
                if (varConfig.type === "select" || varConfig.type === "dropdown") {
                  fieldType = "dropdown";
                } else if (varConfig.type === "number" || varConfig.type === "integer") {
                  fieldType = "number";
                } else if (varConfig.type === "boolean") {
                  fieldType = "text"; // We'll handle boolean separately in renderField
                } else if (varConfig.type === "currency") {
                  fieldType = "currency";
                } else {
                  fieldType = (varConfig.type || "text") as FieldConfig["type"];
                }
                
                // Map variable config to FieldConfig format
                const fieldConfig: FieldConfig = {
                  name: varName,
                  type: fieldType,
                  label: varConfig.label || varName,
                  required: varConfig.required || false,
                  placeholder: varConfig.placeholder,
                  options: varConfig.options,
                  validation: {
                    ...varConfig.validation,
                    // For integer types, ensure step is 1 if not specified
                    step: varConfig.type === "integer" 
                      ? (varConfig.validation?.step || 1)
                      : varConfig.validation?.step,
                  },
                  // Store the original type for boolean and integer handling
                  ...(varConfig.type === "boolean" && { originalType: "boolean" }),
                  ...(varConfig.type === "integer" && { originalType: "integer" }),
                } as FieldConfig & { originalType?: string };
                
                return fieldConfig;
              });
            
            // Pre-populate field values from API response
            // Only populate once per process type change (and not if bucket was selected)
            if (populatedProcessTypeRef.current !== requirement.process_type && !requirement.capability_bucket_id) {
              Object.entries(variables).forEach(([varName, varConfig]: [string, any]) => {
                if (varConfig.addToJobInput === true) {
                  // Handle boolean values - they can be false, which is a valid value
                  const isBoolean = varConfig.type === "boolean";
                  const hasValue = isBoolean
                    ? varConfig.value !== undefined && varConfig.value !== null
                    : varConfig.value !== undefined && 
                      varConfig.value !== null && 
                      varConfig.value !== "";
                  const notAlreadySet = requirement[varName] === undefined || 
                    requirement[varName] === null || 
                    (isBoolean ? false : requirement[varName] === "");
                  
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
  }, [requirement.process_type, requirement.capability_bucket_id]);

  // Handle bucket selection - clear existing fields and populate with bucket capabilities
  const handleBucketChange = (bucketId: string) => {
    if (!bucketId) {
      onChange("capability_bucket_id", "");
      populatedBucketRef.current = null;
      return;
    }

    const bucketIdNum = parseInt(bucketId);
    const selectedBucket = capabilityBuckets.find(b => b.id === bucketIdNum);
    
    if (selectedBucket) {
      onChange("capability_bucket_id", bucketIdNum);
      
      // Clear dynamicFields so machine_variables fields are not displayed
      setDynamicFields([]);
      
      // Clear all existing capability fields (except process_type, price_per_m, and capability_bucket_id)
      // Get all keys from the requirement object
      const fieldsToClear = Object.keys(requirement);
      
      // Clear each field
      fieldsToClear.forEach(fieldName => {
        // Skip process_type, price_per_m, and capability_bucket_id
        if (fieldName !== "process_type" && fieldName !== "price_per_m" && fieldName !== "capability_bucket_id") {
          // Check if this field is in dynamicFields to determine its type
          const field = dynamicFields.find(f => f.name === fieldName);
          if (field) {
            const isBoolean = (field as any).originalType === "boolean";
            if (isBoolean) {
              onChange(fieldName, false);
            } else if (field.type === "number") {
              onChange(fieldName, 0);
            } else {
              onChange(fieldName, "");
            }
          } else {
            // For fields not in dynamicFields, clear to empty string
            onChange(fieldName, "");
          }
        }
      });
      
      // Populate fields with bucket capabilities
      // Only populate if we haven't already populated from this bucket
      if (populatedBucketRef.current !== bucketIdNum) {
        Object.entries(selectedBucket.capabilities).forEach(([key, value]) => {
          // Extract the actual value if it's an object with a "value" property
          let actualValue = value;
          if (typeof value === "object" && value !== null && !Array.isArray(value) && "value" in value) {
            actualValue = (value as any).value;
          }
          
          // Set the field value
          onChange(key, actualValue);
        });
        populatedBucketRef.current = bucketIdNum;
      }
    }
  };

  // Only use dynamic fields from API - no fallback to static config
  const fieldsToRender = dynamicFields;

  const renderField = (field: FieldConfig, index: number) => {
    // Check if this is a boolean field (stored in originalType)
    const isBoolean = (field as any).originalType === "boolean";
    
    // Handle boolean values - default to false if not set
    const value = isBoolean 
      ? (requirement[field.name] !== undefined ? requirement[field.name] : false)
      : (requirement[field.name] || "");
    
    const error = errors[field.name];
    const fieldId = `${field.name}-${index}-${requirement.process_type}`;
    const fieldKey = `${requirement.process_type}-${field.name}-${index}`;

    // Match the styling from AddJobModal/EditJobModal for consistency
    const baseInputClasses = `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      error
        ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500"
        : "border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]"
    }`;

    // Handle boolean fields
    if (isBoolean) {
      return (
        <div key={fieldKey} className="flex-1 min-w-[200px]">
          <label
            htmlFor={fieldId}
            className="flex items-center gap-3 cursor-pointer"
          >
            <input
              type="checkbox"
              id={fieldId}
              checked={value === "true" || value === 1 || (!!value && value !== "false")}
              onChange={(e) => onChange(field.name, e.target.checked ? "true" : "false")}
              className="w-5 h-5 text-[var(--primary-blue)] border-gray-300 rounded focus:ring-[var(--primary-blue)] focus:ring-2"
            />
            <span className="text-sm font-semibold text-[var(--text-dark)]">
              {field.label}{" "}
              {!disableRequired && field.required && <span className="text-red-500">*</span>}
            </span>
          </label>
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      );
    }

    switch (field.type) {
      case "dropdown":
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px]">
            <label
              htmlFor={fieldId}
              className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
            >
              {field.label}{" "}
              {!disableRequired && field.required && <span className="text-red-500">*</span>}
            </label>
            <select
              id={fieldId}
              value={value as string}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={baseInputClasses}
              required={!disableRequired && field.required}
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
        const isInteger = (field as any).originalType === "integer";
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px]">
            <label
              htmlFor={fieldId}
              className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
            >
              {field.label}{" "}
              {!disableRequired && field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              id={fieldId}
              value={value as number}
              onChange={(e) => {
                const inputValue = e.target.value;
                // Use parseInt for integers, parseFloat for numbers
                const parsedValue = isInteger
                  ? (inputValue === "" ? 0 : parseInt(inputValue, 10) || 0)
                  : (inputValue === "" ? 0 : parseFloat(inputValue) || 0);
                onChange(field.name, parsedValue);
              }}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.validation?.step || (isInteger ? 1 : undefined)}
              placeholder={field.placeholder}
              className={baseInputClasses}
              required={!disableRequired && field.required}
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
              {!disableRequired && field.required && <span className="text-red-500">*</span>}
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
                required={!disableRequired && field.required}
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
              {!disableRequired && field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              id={fieldId}
              value={value as string}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClasses}
              required={!disableRequired && field.required}
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
          Process Type {!disableRequired && <span className="text-red-500">*</span>}
        </label>
        <select
          id="process-type"
          value={requirement.process_type}
          onChange={(e) => {
            onChange("process_type", e.target.value);
            // Clear bucket selection when process type changes
            onChange("capability_bucket_id", "");
            populatedBucketRef.current = null;
          }}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.process_type
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]"
          }`}
          required={!disableRequired}
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

      {/* Capability Bucket Selector - shown after process type is selected */}
      {requirement.process_type && (
        <div className="w-full">
          <label
            htmlFor="capability-bucket"
            className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
          >
            Capability Bucket <span className="text-gray-500 text-xs font-normal">(optional)</span>
          </label>
          {isLoadingBuckets ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-light)]">
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
              <span>Loading buckets...</span>
            </div>
          ) : (
            <select
              id="capability-bucket"
              value={requirement.capability_bucket_id ? String(requirement.capability_bucket_id) : ""}
              onChange={(e) => handleBucketChange(e.target.value)}
              className="w-full px-4 py-3 text-base border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)] transition-colors"
            >
              <option value="">Select a bucket (optional)...</option>
              {capabilityBuckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name}
                </option>
              ))}
            </select>
          )}
          {capabilityBuckets.length === 0 && !isLoadingBuckets && (
            <p className="mt-1 text-xs text-gray-500 italic">
              No capability buckets available
            </p>
          )}
          
          {/* Display selected bucket capabilities */}
          {requirement.capability_bucket_id && !isLoadingBuckets && (() => {
            const selectedBucket = capabilityBuckets.find(
              b => b.id === requirement.capability_bucket_id
            );
            
            if (selectedBucket && selectedBucket.capabilities) {
              const capabilities = selectedBucket.capabilities;
              const capabilityEntries = Object.entries(capabilities);
              
              if (capabilityEntries.length > 0) {
                return (
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h5 className="text-sm font-semibold text-[var(--text-dark)] mb-2">
                      Bucket Capabilities:
                    </h5>
                    <div className="space-y-1">
                      {capabilityEntries.map(([key, value]) => {
                        // Check if value is an object with label and value properties (capability metadata)
                        let displayKey: string;
                        let displayValue: string;
                        let actualValue: any = value;
                        
                        if (typeof value === "object" && value !== null && !Array.isArray(value) && "label" in value && "value" in value) {
                          // Use the label from the object as the display key
                          displayKey = (value as any).label || key;
                          // Use the actual value from the object
                          actualValue = (value as any).value;
                        } else {
                          // Format the key for display (convert camelCase to Title Case)
                          displayKey = key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, str => str.toUpperCase())
                            .trim();
                        }
                        
                        // Format the actual value for display
                        // Handle null/undefined first
                        if (actualValue === null || actualValue === undefined) {
                          displayValue = "N/A";
                        }
                        // Handle boolean values (check both primitive and object cases)
                        else if (typeof actualValue === "boolean") {
                          displayValue = actualValue ? "Yes" : "No";
                        }
                        // Handle objects - check if it's a boolean object or stringify it
                        else if (typeof actualValue === "object") {
                          // Check if it's an array
                          if (Array.isArray(actualValue)) {
                            displayValue = actualValue.length > 0 ? JSON.stringify(actualValue) : "[]";
                          }
                          // Check if it's a boolean object (e.g., Boolean(false))
                          else if (actualValue instanceof Boolean) {
                            displayValue = actualValue.valueOf() ? "Yes" : "No";
                          }
                          // Check if it's an empty object
                          else if (Object.keys(actualValue).length === 0) {
                            displayValue = "N/A";
                          }
                          // For other objects, stringify them
                          else {
                            try {
                              displayValue = JSON.stringify(actualValue);
                            } catch {
                              displayValue = String(actualValue);
                            }
                          }
                        }
                        // Handle strings that might represent booleans
                        else if (typeof actualValue === "string") {
                          const lowerValue = actualValue.toLowerCase().trim();
                          if (lowerValue === "true" || lowerValue === "1") {
                            displayValue = "Yes";
                          } else if (lowerValue === "false" || lowerValue === "0") {
                            displayValue = "No";
                          } else {
                            displayValue = actualValue;
                          }
                        }
                        // Handle numbers that might represent booleans (0/1)
                        else if (typeof actualValue === "number") {
                          if (actualValue === 1 || actualValue === 0) {
                            displayValue = actualValue === 1 ? "Yes" : "No";
                          } else {
                            displayValue = String(actualValue);
                          }
                        }
                        // Fallback to string conversion
                        else {
                          displayValue = String(actualValue);
                        }
                        
                        return (
                          <div key={key} className="flex items-start gap-2 text-sm">
                            <span className="text-[var(--text-light)] font-medium min-w-[120px]">
                              {displayKey}:
                            </span>
                            <span className="text-[var(--text-dark)] font-semibold">
                              {displayValue}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            }
            return null;
          })()}
        </div>
      )}

      {/* Dynamic Fields Based on Selected Process Type - Don't show if bucket is selected */}
      {!requirement.capability_bucket_id && (
        <>
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
        </>
      )}

      {/* Help Text */}
      {!requirement.process_type && !isLoadingFields && (
        <p className="text-sm text-gray-500 italic">
          Select a process type to see relevant fields
        </p>
      )}

      {/* Info badge when using dynamic fields - Don't show if bucket is selected */}
      {!requirement.capability_bucket_id && dynamicFields.length > 0 && !isLoadingFields && (
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
